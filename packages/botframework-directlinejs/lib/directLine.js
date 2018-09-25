"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.DirectLine = exports.ConnectionStatus = void 0;

var _objectWithoutProperties2 = _interopRequireDefault(require("@babel/runtime/helpers/objectWithoutProperties"));

var _classCallCheck2 = _interopRequireDefault(require("@babel/runtime/helpers/classCallCheck"));

var _createClass2 = _interopRequireDefault(require("@babel/runtime/helpers/createClass"));

var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));

var _BehaviorSubject = require("rxjs/BehaviorSubject");

var _Observable = require("rxjs/Observable");

require("rxjs/add/operator/catch");

require("rxjs/add/operator/combineLatest");

require("rxjs/add/operator/count");

require("rxjs/add/operator/delay");

require("rxjs/add/operator/do");

require("rxjs/add/operator/filter");

require("rxjs/add/operator/map");

require("rxjs/add/operator/mergeMap");

require("rxjs/add/operator/retryWhen");

require("rxjs/add/operator/share");

require("rxjs/add/operator/take");

require("rxjs/add/observable/dom/ajax");

require("rxjs/add/observable/empty");

require("rxjs/add/observable/from");

require("rxjs/add/observable/interval");

require("rxjs/add/observable/of");

require("rxjs/add/observable/throw");

// In order to keep file size down, only import the parts of rxjs that we use
// These types are specific to this client library, not to Direct Line 3.0
var ConnectionStatus;
exports.ConnectionStatus = ConnectionStatus;

(function (ConnectionStatus) {
  ConnectionStatus[ConnectionStatus["Uninitialized"] = 0] = "Uninitialized";
  ConnectionStatus[ConnectionStatus["Connecting"] = 1] = "Connecting";
  ConnectionStatus[ConnectionStatus["Online"] = 2] = "Online";
  ConnectionStatus[ConnectionStatus["ExpiredToken"] = 3] = "ExpiredToken";
  ConnectionStatus[ConnectionStatus["FailedToConnect"] = 4] = "FailedToConnect";
  ConnectionStatus[ConnectionStatus["Ended"] = 5] = "Ended";
})(ConnectionStatus || (exports.ConnectionStatus = ConnectionStatus = {}));

var lifetimeRefreshToken = 30 * 60 * 1000;
var intervalRefreshToken = lifetimeRefreshToken / 2;
var timeout = 20 * 1000;
var retries = (lifetimeRefreshToken - intervalRefreshToken) / timeout;
var errorExpiredToken = new Error("expired token");
var errorConversationEnded = new Error("conversation ended");
var errorFailedToConnect = new Error("failed to connect");
var konsole = {
  log: function log(message) {
    var _console;

    for (var _len = arguments.length, optionalParams = new Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
      optionalParams[_key - 1] = arguments[_key];
    }

    if (typeof window !== 'undefined' && window["botchatDebug"] && message) (_console = console).log.apply(_console, [message].concat(optionalParams));
  }
};

var DirectLine =
/*#__PURE__*/
function () {
  function DirectLine(options) {
    (0, _classCallCheck2.default)(this, DirectLine);
    (0, _defineProperty2.default)(this, "connectionStatus$", new _BehaviorSubject.BehaviorSubject(ConnectionStatus.Uninitialized));
    (0, _defineProperty2.default)(this, "activity$", void 0);
    (0, _defineProperty2.default)(this, "domain", "https://directline.botframework.com/v3/directline");
    (0, _defineProperty2.default)(this, "webSocket", void 0);
    (0, _defineProperty2.default)(this, "conversationId", void 0);
    (0, _defineProperty2.default)(this, "secret", void 0);
    (0, _defineProperty2.default)(this, "token", void 0);
    (0, _defineProperty2.default)(this, "watermark", '');
    (0, _defineProperty2.default)(this, "streamUrl", void 0);
    (0, _defineProperty2.default)(this, "referenceGrammarId", void 0);
    (0, _defineProperty2.default)(this, "pollingInterval", 1000);
    (0, _defineProperty2.default)(this, "tokenRefreshSubscription", void 0);
    this.secret = options.secret;
    this.token = options.secret || options.token;
    this.webSocket = (options.webSocket === undefined ? true : options.webSocket) && typeof WebSocket !== 'undefined' && WebSocket !== undefined;
    if (options.domain) this.domain = options.domain;

    if (options.conversationId) {
      this.conversationId = options.conversationId;
    }

    if (options.watermark) {
      if (this.webSocket) console.warn("Watermark was ignored: it is not supported using websockets at the moment");else this.watermark = options.watermark;
    }

    if (options.streamUrl) {
      if (options.token && options.conversationId) this.streamUrl = options.streamUrl;else console.warn("streamUrl was ignored: you need to provide a token and a conversationid");
    }

    if (options.pollingInterval !== undefined) this.pollingInterval = options.pollingInterval;
    this.activity$ = (this.webSocket ? this.webSocketActivity$() : this.pollingGetActivity$()).share();
  } // Every time we're about to make a Direct Line REST call, we call this first to see check the current connection status.
  // Either throws an error (indicating an error state) or emits a null, indicating a (presumably) healthy connection


  (0, _createClass2.default)(DirectLine, [{
    key: "checkConnection",
    value: function checkConnection() {
      var _this = this;

      var once = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : false;
      var obs = this.connectionStatus$.flatMap(function (connectionStatus) {
        if (connectionStatus === ConnectionStatus.Uninitialized) {
          _this.connectionStatus$.next(ConnectionStatus.Connecting); //if token and streamUrl are defined it means reconnect has already been done. Skipping it.


          if (_this.token && _this.streamUrl) {
            _this.connectionStatus$.next(ConnectionStatus.Online);

            return _Observable.Observable.of(connectionStatus);
          } else {
            return _this.startConversation().do(function (conversation) {
              _this.conversationId = conversation.conversationId;
              _this.token = _this.secret || conversation.token;
              _this.streamUrl = conversation.streamUrl;
              _this.referenceGrammarId = conversation.referenceGrammarId;
              if (!_this.secret) _this.refreshTokenLoop();

              _this.connectionStatus$.next(ConnectionStatus.Online);
            }, function (error) {
              _this.connectionStatus$.next(ConnectionStatus.FailedToConnect);
            }).map(function (_) {
              return connectionStatus;
            });
          }
        } else {
          return _Observable.Observable.of(connectionStatus);
        }
      }).filter(function (connectionStatus) {
        return connectionStatus != ConnectionStatus.Uninitialized && connectionStatus != ConnectionStatus.Connecting;
      }).flatMap(function (connectionStatus) {
        switch (connectionStatus) {
          case ConnectionStatus.Ended:
            return _Observable.Observable.throw(errorConversationEnded);

          case ConnectionStatus.FailedToConnect:
            return _Observable.Observable.throw(errorFailedToConnect);

          case ConnectionStatus.ExpiredToken:
            return _Observable.Observable.throw(errorExpiredToken);

          default:
            return _Observable.Observable.of(null);
        }
      });
      return once ? obs.take(1) : obs;
    }
  }, {
    key: "expiredToken",
    value: function expiredToken() {
      var connectionStatus = this.connectionStatus$.getValue();
      if (connectionStatus != ConnectionStatus.Ended && connectionStatus != ConnectionStatus.FailedToConnect) this.connectionStatus$.next(ConnectionStatus.ExpiredToken);
    }
  }, {
    key: "startConversation",
    value: function startConversation() {
      //if conversationid is set here, it means we need to call the reconnect api, else it is a new conversation
      var url = this.conversationId ? "".concat(this.domain, "/conversations/").concat(this.conversationId, "?watermark=").concat(this.watermark) : "".concat(this.domain, "/conversations");
      var method = this.conversationId ? "GET" : "POST";
      return _Observable.Observable.ajax({
        method: method,
        url: url,
        timeout: timeout,
        headers: {
          "Accept": "application/json",
          "Authorization": "Bearer ".concat(this.token)
        }
      }) //      .do(ajaxResponse => konsole.log("conversation ajaxResponse", ajaxResponse.response))
      .map(function (ajaxResponse) {
        return ajaxResponse.response;
      }).retryWhen(function (error$) {
        return (// for now we deem 4xx and 5xx errors as unrecoverable
          // for everything else (timeouts), retry for a while
          error$.mergeMap(function (error) {
            return error.status >= 400 && error.status < 600 ? _Observable.Observable.throw(error) : _Observable.Observable.of(error);
          }).delay(timeout).take(retries)
        );
      });
    }
  }, {
    key: "refreshTokenLoop",
    value: function refreshTokenLoop() {
      var _this2 = this;

      this.tokenRefreshSubscription = _Observable.Observable.interval(intervalRefreshToken).flatMap(function (_) {
        return _this2.refreshToken();
      }).subscribe(function (token) {
        konsole.log("refreshing token", token, "at", new Date());
        _this2.token = token;
      });
    }
  }, {
    key: "refreshToken",
    value: function refreshToken() {
      var _this3 = this;

      return this.checkConnection(true).flatMap(function (_) {
        return _Observable.Observable.ajax({
          method: "POST",
          url: "".concat(_this3.domain, "/tokens/refresh"),
          timeout: timeout,
          headers: {
            "Authorization": "Bearer ".concat(_this3.token)
          }
        }).map(function (ajaxResponse) {
          return ajaxResponse.response.token;
        }).retryWhen(function (error$) {
          return error$.mergeMap(function (error) {
            if (error.status === 403) {
              // if the token is expired there's no reason to keep trying
              _this3.expiredToken();

              return _Observable.Observable.throw(error);
            }

            return _Observable.Observable.of(error);
          }).delay(timeout).take(retries);
        });
      });
    }
  }, {
    key: "reconnect",
    value: function reconnect(conversation) {
      this.token = conversation.token;
      this.streamUrl = conversation.streamUrl;
      if (this.connectionStatus$.getValue() === ConnectionStatus.ExpiredToken) this.connectionStatus$.next(ConnectionStatus.Online);
    }
  }, {
    key: "end",
    value: function end() {
      if (this.tokenRefreshSubscription) this.tokenRefreshSubscription.unsubscribe();
      this.connectionStatus$.next(ConnectionStatus.Ended);
    }
  }, {
    key: "getSessionId",
    value: function getSessionId() {
      var _this4 = this;

      // If we're not connected to the bot, get connected
      // Will throw an error if we are not connected
      konsole.log("getSessionId");
      return this.checkConnection(true).flatMap(function (_) {
        return _Observable.Observable.ajax({
          method: "GET",
          url: "".concat(_this4.domain, "/session/getsessionid"),
          withCredentials: true,
          timeout: timeout,
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer ".concat(_this4.token)
          }
        }).map(function (ajaxResponse) {
          if (ajaxResponse && ajaxResponse.response && ajaxResponse.response.sessionId) {
            konsole.log("getSessionId response: " + ajaxResponse.response.sessionId);
            return ajaxResponse.response.sessionId;
          }

          return '';
        }).catch(function (error) {
          konsole.log("getSessionId error: " + error.status);
          return _Observable.Observable.of('');
        });
      }).catch(function (error) {
        return _this4.catchExpiredToken(error);
      });
    }
  }, {
    key: "postActivity",
    value: function postActivity(activity) {
      var _this5 = this;

      // Use postMessageWithAttachments for messages with attachments that are local files (e.g. an image to upload)
      // Technically we could use it for *all* activities, but postActivity is much lighter weight
      // So, since WebChat is partially a reference implementation of Direct Line, we implement both.
      if (activity.type === "message" && activity.attachments && activity.attachments.length > 0) return this.postMessageWithAttachments(activity); // If we're not connected to the bot, get connected
      // Will throw an error if we are not connected

      konsole.log("postActivity", activity);
      return this.checkConnection(true).flatMap(function (_) {
        return _Observable.Observable.ajax({
          method: "POST",
          url: "".concat(_this5.domain, "/conversations/").concat(_this5.conversationId, "/activities"),
          body: activity,
          timeout: timeout,
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer ".concat(_this5.token)
          }
        }).map(function (ajaxResponse) {
          return ajaxResponse.response.id;
        }).catch(function (error) {
          return _this5.catchPostError(error);
        });
      }).catch(function (error) {
        return _this5.catchExpiredToken(error);
      });
    }
  }, {
    key: "postMessageWithAttachments",
    value: function postMessageWithAttachments(_ref) {
      var _this6 = this;

      var attachments = _ref.attachments,
          messageWithoutAttachments = (0, _objectWithoutProperties2.default)(_ref, ["attachments"]);
      var formData; // If we're not connected to the bot, get connected
      // Will throw an error if we are not connected

      return this.checkConnection(true).flatMap(function (_) {
        // To send this message to DirectLine we need to deconstruct it into a "template" activity
        // and one blob for each attachment.
        formData = new FormData();
        formData.append('activity', new Blob([JSON.stringify(messageWithoutAttachments)], {
          type: 'application/vnd.microsoft.activity'
        }));
        return _Observable.Observable.from(attachments || []).flatMap(function (media) {
          return _Observable.Observable.ajax({
            method: "GET",
            url: media.contentUrl,
            responseType: 'arraybuffer'
          }).do(function (ajaxResponse) {
            return formData.append('file', new Blob([ajaxResponse.response], {
              type: media.contentType
            }), media.name);
          });
        }).count();
      }).flatMap(function (_) {
        return _Observable.Observable.ajax({
          method: "POST",
          url: "".concat(_this6.domain, "/conversations/").concat(_this6.conversationId, "/upload?userId=").concat(messageWithoutAttachments.from.id),
          body: formData,
          timeout: timeout,
          headers: {
            "Authorization": "Bearer ".concat(_this6.token)
          }
        }).map(function (ajaxResponse) {
          return ajaxResponse.response.id;
        }).catch(function (error) {
          return _this6.catchPostError(error);
        });
      }).catch(function (error) {
        return _this6.catchPostError(error);
      });
    }
  }, {
    key: "catchPostError",
    value: function catchPostError(error) {
      if (error.status === 403) // token has expired (will fall through to return "retry")
        this.expiredToken();else if (error.status >= 400 && error.status < 500) // more unrecoverable errors
        return _Observable.Observable.throw(error);
      return _Observable.Observable.of("retry");
    }
  }, {
    key: "catchExpiredToken",
    value: function catchExpiredToken(error) {
      return error === errorExpiredToken ? _Observable.Observable.of("retry") : _Observable.Observable.throw(error);
    }
  }, {
    key: "pollingGetActivity$",
    value: function pollingGetActivity$() {
      var _this7 = this;

      return _Observable.Observable.interval(this.pollingInterval).combineLatest(this.checkConnection()).flatMap(function (_) {
        return _Observable.Observable.ajax({
          method: "GET",
          url: "".concat(_this7.domain, "/conversations/").concat(_this7.conversationId, "/activities?watermark=").concat(_this7.watermark),
          timeout: timeout,
          headers: {
            "Accept": "application/json",
            "Authorization": "Bearer ".concat(_this7.token)
          }
        }).catch(function (error) {
          if (error.status === 403) {
            // This is slightly ugly. We want to update this.connectionStatus$ to ExpiredToken so that subsequent
            // calls to checkConnection will throw an error. But when we do so, it causes this.checkConnection()
            // to immediately throw an error, which is caught by the catch() below and transformed into an empty
            // object. Then next() returns, and we emit an empty object. Which means one 403 is causing
            // two empty objects to be emitted. Which is harmless but, again, slightly ugly.
            _this7.expiredToken();
          }

          return _Observable.Observable.empty();
        }) //          .do(ajaxResponse => konsole.log("getActivityGroup ajaxResponse", ajaxResponse))
        .map(function (ajaxResponse) {
          return ajaxResponse.response;
        }).flatMap(function (activityGroup) {
          return _this7.observableFromActivityGroup(activityGroup);
        });
      }).catch(function (error) {
        return _Observable.Observable.empty();
      });
    }
  }, {
    key: "observableFromActivityGroup",
    value: function observableFromActivityGroup(activityGroup) {
      if (activityGroup.watermark) this.watermark = activityGroup.watermark;
      return _Observable.Observable.from(activityGroup.activities);
    }
  }, {
    key: "webSocketActivity$",
    value: function webSocketActivity$() {
      var _this8 = this;

      return this.checkConnection().flatMap(function (_) {
        return _this8.observableWebSocket() // WebSockets can be closed by the server or the browser. In the former case we need to
        // retrieve a new streamUrl. In the latter case we could first retry with the current streamUrl,
        // but it's simpler just to always fetch a new one.
        .retryWhen(function (error$) {
          return error$.mergeMap(function (error) {
            return _this8.reconnectToConversation();
          });
        });
      }).flatMap(function (activityGroup) {
        return _this8.observableFromActivityGroup(activityGroup);
      });
    } // Originally we used Observable.webSocket, but it's fairly opionated  and I ended up writing
    // a lot of code to work around their implemention details. Since WebChat is meant to be a reference
    // implementation, I decided roll the below, where the logic is more purposeful. - @billba

  }, {
    key: "observableWebSocket",
    value: function observableWebSocket() {
      var _this9 = this;

      return _Observable.Observable.create(function (subscriber) {
        konsole.log("creating WebSocket", _this9.streamUrl);
        var ws = new WebSocket(_this9.streamUrl);
        var sub;

        ws.onopen = function (open) {
          konsole.log("WebSocket open", open); // Chrome is pretty bad at noticing when a WebSocket connection is broken.
          // If we periodically ping the server with empty messages, it helps Chrome
          // realize when connection breaks, and close the socket. We then throw an
          // error, and that give us the opportunity to attempt to reconnect.

          sub = _Observable.Observable.interval(timeout).subscribe(function (_) {
            return ws.send("");
          });
        };

        ws.onclose = function (close) {
          konsole.log("WebSocket close", close);
          if (sub) sub.unsubscribe();
          subscriber.error(close);
        };

        ws.onmessage = function (message) {
          return message.data && subscriber.next(JSON.parse(message.data));
        }; // This is the 'unsubscribe' method, which is called when this observable is disposed.
        // When the WebSocket closes itself, we throw an error, and this function is eventually called.
        // When the observable is closed first (e.g. when tearing down a WebChat instance) then
        // we need to manually close the WebSocket.


        return function () {
          if (ws.readyState === 0 || ws.readyState === 1) ws.close();
        };
      });
    }
  }, {
    key: "reconnectToConversation",
    value: function reconnectToConversation() {
      var _this10 = this;

      return this.checkConnection(true).flatMap(function (_) {
        return _Observable.Observable.ajax({
          method: "GET",
          url: "".concat(_this10.domain, "/conversations/").concat(_this10.conversationId, "?watermark=").concat(_this10.watermark),
          timeout: timeout,
          headers: {
            "Accept": "application/json",
            "Authorization": "Bearer ".concat(_this10.token)
          }
        }).do(function (result) {
          if (!_this10.secret) _this10.token = result.response.token;
          _this10.streamUrl = result.response.streamUrl;
        }).map(function (_) {
          return null;
        }).retryWhen(function (error$) {
          return error$.mergeMap(function (error) {
            if (error.status === 403) {
              // token has expired. We can't recover from this here, but the embedding
              // website might eventually call reconnect() with a new token and streamUrl.
              _this10.expiredToken();
            }

            return _Observable.Observable.of(error);
          }).delay(timeout).take(retries);
        });
      });
    }
  }]);
  return DirectLine;
}();

exports.DirectLine = DirectLine;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9kaXJlY3RMaW5lLnRzIl0sIm5hbWVzIjpbIkNvbm5lY3Rpb25TdGF0dXMiLCJsaWZldGltZVJlZnJlc2hUb2tlbiIsImludGVydmFsUmVmcmVzaFRva2VuIiwidGltZW91dCIsInJldHJpZXMiLCJlcnJvckV4cGlyZWRUb2tlbiIsIkVycm9yIiwiZXJyb3JDb252ZXJzYXRpb25FbmRlZCIsImVycm9yRmFpbGVkVG9Db25uZWN0Iiwia29uc29sZSIsImxvZyIsIm1lc3NhZ2UiLCJvcHRpb25hbFBhcmFtcyIsIndpbmRvdyIsImNvbnNvbGUiLCJEaXJlY3RMaW5lIiwib3B0aW9ucyIsIkJlaGF2aW9yU3ViamVjdCIsIlVuaW5pdGlhbGl6ZWQiLCJzZWNyZXQiLCJ0b2tlbiIsIndlYlNvY2tldCIsInVuZGVmaW5lZCIsIldlYlNvY2tldCIsImRvbWFpbiIsImNvbnZlcnNhdGlvbklkIiwid2F0ZXJtYXJrIiwid2FybiIsInN0cmVhbVVybCIsInBvbGxpbmdJbnRlcnZhbCIsImFjdGl2aXR5JCIsIndlYlNvY2tldEFjdGl2aXR5JCIsInBvbGxpbmdHZXRBY3Rpdml0eSQiLCJzaGFyZSIsIm9uY2UiLCJvYnMiLCJjb25uZWN0aW9uU3RhdHVzJCIsImZsYXRNYXAiLCJjb25uZWN0aW9uU3RhdHVzIiwibmV4dCIsIkNvbm5lY3RpbmciLCJPbmxpbmUiLCJPYnNlcnZhYmxlIiwib2YiLCJzdGFydENvbnZlcnNhdGlvbiIsImRvIiwiY29udmVyc2F0aW9uIiwicmVmZXJlbmNlR3JhbW1hcklkIiwicmVmcmVzaFRva2VuTG9vcCIsImVycm9yIiwiRmFpbGVkVG9Db25uZWN0IiwibWFwIiwiXyIsImZpbHRlciIsIkVuZGVkIiwidGhyb3ciLCJFeHBpcmVkVG9rZW4iLCJ0YWtlIiwiZ2V0VmFsdWUiLCJ1cmwiLCJtZXRob2QiLCJhamF4IiwiaGVhZGVycyIsImFqYXhSZXNwb25zZSIsInJlc3BvbnNlIiwicmV0cnlXaGVuIiwiZXJyb3IkIiwibWVyZ2VNYXAiLCJzdGF0dXMiLCJkZWxheSIsInRva2VuUmVmcmVzaFN1YnNjcmlwdGlvbiIsImludGVydmFsIiwicmVmcmVzaFRva2VuIiwic3Vic2NyaWJlIiwiRGF0ZSIsImNoZWNrQ29ubmVjdGlvbiIsImV4cGlyZWRUb2tlbiIsInVuc3Vic2NyaWJlIiwid2l0aENyZWRlbnRpYWxzIiwic2Vzc2lvbklkIiwiY2F0Y2giLCJjYXRjaEV4cGlyZWRUb2tlbiIsImFjdGl2aXR5IiwidHlwZSIsImF0dGFjaG1lbnRzIiwibGVuZ3RoIiwicG9zdE1lc3NhZ2VXaXRoQXR0YWNobWVudHMiLCJib2R5IiwiaWQiLCJjYXRjaFBvc3RFcnJvciIsIm1lc3NhZ2VXaXRob3V0QXR0YWNobWVudHMiLCJmb3JtRGF0YSIsIkZvcm1EYXRhIiwiYXBwZW5kIiwiQmxvYiIsIkpTT04iLCJzdHJpbmdpZnkiLCJmcm9tIiwibWVkaWEiLCJjb250ZW50VXJsIiwicmVzcG9uc2VUeXBlIiwiY29udGVudFR5cGUiLCJuYW1lIiwiY291bnQiLCJjb21iaW5lTGF0ZXN0IiwiZW1wdHkiLCJhY3Rpdml0eUdyb3VwIiwib2JzZXJ2YWJsZUZyb21BY3Rpdml0eUdyb3VwIiwiYWN0aXZpdGllcyIsIm9ic2VydmFibGVXZWJTb2NrZXQiLCJyZWNvbm5lY3RUb0NvbnZlcnNhdGlvbiIsImNyZWF0ZSIsInN1YnNjcmliZXIiLCJ3cyIsInN1YiIsIm9ub3BlbiIsIm9wZW4iLCJzZW5kIiwib25jbG9zZSIsImNsb3NlIiwib25tZXNzYWdlIiwiZGF0YSIsInBhcnNlIiwicmVhZHlTdGF0ZSIsInJlc3VsdCJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFHQTs7QUFDQTs7QUFJQTs7QUFDQTs7QUFDQTs7QUFDQTs7QUFDQTs7QUFDQTs7QUFDQTs7QUFDQTs7QUFDQTs7QUFDQTs7QUFDQTs7QUFFQTs7QUFDQTs7QUFDQTs7QUFDQTs7QUFDQTs7QUFDQTs7QUF6QkE7QUF3UEE7SUFFWUEsZ0I7OztXQUFBQSxnQjtBQUFBQSxFQUFBQSxnQixDQUFB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QUEsT0FBSSxDQUFDUSxZQUFMO0FBQ0g7O0FBQ0QsbUJBQU9sQyx1QkFBV0MsRUFBWCxDQUFjTSxLQUFkLENBQVA7QUFDSCxXQVJnQixFQVNoQm9CLEtBVGdCLENBU1ZsRSxPQVRVLEVBVWhCc0QsSUFWZ0IsQ0FVWHJELE9BVlcsQ0FBSjtBQUFBLFNBZmpCLENBRE07QUFBQSxPQURILENBQVA7QUE4QkgiLCJzb3VyY2VzQ29udGVudCI6WyIvLyBJbiBvcmRlciB0byBrZWVwIGZpbGUgc2l6ZSBkb3duLCBvbmx5IGltcG9ydCB0aGUgcGFydHMgb2YgcnhqcyB0aGF0IHdlIHVzZVxuXG5pbXBvcnQgeyBBamF4UmVzcG9uc2UsIEFqYXhSZXF1ZXN0IH0gZnJvbSAncnhqcy9vYnNlcnZhYmxlL2RvbS9BamF4T2JzZXJ2YWJsZSc7XG5pbXBvcnQgeyBCZWhhdmlvclN1YmplY3QgfSBmcm9tICdyeGpzL0JlaGF2aW9yU3ViamVjdCc7XG5pbXBvcnQgeyBPYnNlcnZhYmxlIH0gZnJvbSAncnhqcy9PYnNlcnZhYmxlJztcbmltcG9ydCB7IFN1YnNjcmliZXIgfSBmcm9tICdyeGpzL1N1YnNjcmliZXInO1xuaW1wb3J0IHsgU3Vic2NyaXB0aW9uIH0gZnJvbSAncnhqcy9TdWJzY3JpcHRpb24nO1xuXG5pbXBvcnQgJ3J4anMvYWRkL29wZXJhdG9yL2NhdGNoJztcbmltcG9ydCAncnhqcy9hZGQvb3BlcmF0b3IvY29tYmluZUxhdGVzdCc7XG5pbXBvcnQgJ3J4anMvYWRkL29wZXJhdG9yL2NvdW50JztcbmltcG9ydCAncnhqcy9hZGQvb3BlcmF0b3IvZGVsYXknO1xuaW1wb3J0ICdyeGpzL2FkZC9vcGVyYXRvci9kbyc7XG5pbXBvcnQgJ3J4anMvYWRkL29wZXJhdG9yL2ZpbHRlcic7XG5pbXBvcnQgJ3J4anMvYWRkL29wZXJhdG9yL21hcCc7XG5pbXBvcnQgJ3J4anMvYWRkL29wZXJhdG9yL21lcmdlTWFwJztcbmltcG9ydCAncnhqcy9hZGQvb3BlcmF0b3IvcmV0cnlXaGVuJztcbmltcG9ydCAncnhqcy9hZGQvb3BlcmF0b3Ivc2hhcmUnO1xuaW1wb3J0ICdyeGpzL2FkZC9vcGVyYXRvci90YWtlJztcblxuaW1wb3J0ICdyeGpzL2FkZC9vYnNlcnZhYmxlL2RvbS9hamF4JztcbmltcG9ydCAncnhqcy9hZGQvb2JzZXJ2YWJsZS9lbXB0eSc7XG5pbXBvcnQgJ3J4anMvYWRkL29ic2VydmFibGUvZnJvbSc7XG5pbXBvcnQgJ3J4anMvYWRkL29ic2VydmFibGUvaW50ZXJ2YWwnO1xuaW1wb3J0ICdyeGpzL2FkZC9vYnNlcnZhYmxlL29mJztcbmltcG9ydCAncnhqcy9hZGQvb2JzZXJ2YWJsZS90aHJvdyc7XG5cbi8vIERpcmVjdCBMaW5lIDMuMCB0eXBlc1xuXG5leHBvcnQgaW50ZXJmYWNlIENvbnZlcnNhdGlvbiB7XG4gICAgY29udmVyc2F0aW9uSWQ6IHN0cmluZyxcbiAgICB0b2tlbjogc3RyaW5nLFxuICAgIGVUYWc/OiBzdHJpbmcsXG4gICAgc3RyZWFtVXJsPzogc3RyaW5nLFxuICAgIHJlZmVyZW5jZUdyYW1tYXJJZD86IHN0cmluZ1xufVxuXG5leHBvcnQgdHlwZSBNZWRpYVR5cGUgPSBcImltYWdlL3BuZ1wiIHwgXCJpbWFnZS9qcGdcIiB8IFwiaW1hZ2UvanBlZ1wiIHwgXCJpbWFnZS9naWZcIiB8IFwiaW1hZ2Uvc3ZnK3htbFwiIHwgXCJhdWRpby9tcGVnXCIgfCBcImF1ZGlvL21wNFwiIHwgXCJ2aWRlby9tcDRcIjtcblxuZXhwb3J0IGludGVyZmFjZSBNZWRpYSB7XG4gICAgY29udGVudFR5cGU6IE1lZGlhVHlwZSxcbiAgICBjb250ZW50VXJsOiBzdHJpbmcsXG4gICAgbmFtZT86IHN0cmluZyxcbiAgICB0aHVtYm5haWxVcmw/OiBzdHJpbmdcbn1cblxuZXhwb3J0IGludGVyZmFjZSBVbmtub3duTWVkaWF7XG4gICAgY29udGVudFR5cGU6IHN0cmluZyxcbiAgICBjb250ZW50VXJsOiBzdHJpbmcsXG4gICAgbmFtZT86IHN0cmluZyxcbiAgICB0aHVtYm5haWxVcmw/OiBzdHJpbmdcbn1cblxuZXhwb3J0IHR5cGUgQ2FyZEFjdGlvblR5cGVzID0gXCJvcGVuVXJsXCIgfCBcImltQmFja1wiIHwgXCJwb3N0QmFja1wiIHwgXCJwbGF5QXVkaW9cIiB8IFwicGxheVZpZGVvXCIgfCBcInNob3dJbWFnZVwiIHwgXCJkb3dubG9hZEZpbGVcIiB8IFwic2lnbmluXCIgfCBcImNhbGxcIjtcblxuZXhwb3J0IGludGVyZmFjZSBDYXJkQWN0aW9uIHtcbiAgICB0eXBlOiBDYXJkQWN0aW9uVHlwZXMsXG4gICAgdGl0bGU6IHN0cmluZyxcbiAgICB2YWx1ZTogYW55LFxuICAgIGltYWdlPzogc3RyaW5nXG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgQ2FyZEltYWdlIHtcbiAgICBhbHQ/OiBzdHJpbmcsXG4gICAgdXJsOiBzdHJpbmcsXG4gICAgdGFwPzogQ2FyZEFjdGlvblxufVxuXG5leHBvcnQgaW50ZXJmYWNlIEhlcm9DYXJkIHtcbiAgICBjb250ZW50VHlwZTogXCJhcHBsaWNhdGlvbi92bmQubWljcm9zb2Z0LmNhcmQuaGVyb1wiLFxuICAgIGNvbnRlbnQ6IHtcbiAgICAgICAgdGl0bGU/OiBzdHJpbmcsXG4gICAgICAgIHN1YnRpdGxlPzogc3RyaW5nLFxuICAgICAgICB0ZXh0Pzogc3RyaW5nLFxuICAgICAgICBpbWFnZXM/OiBDYXJkSW1hZ2VbXSxcbiAgICAgICAgYnV0dG9ucz86IENhcmRBY3Rpb25bXSxcbiAgICAgICAgdGFwPzogQ2FyZEFjdGlvblxuICAgIH1cbn1cblxuZXhwb3J0IGludGVyZmFjZSBUaHVtYm5haWwge1xuICAgIGNvbnRlbnRUeXBlOiBcImFwcGxpY2F0aW9uL3ZuZC5taWNyb3NvZnQuY2FyZC50aHVtYm5haWxcIixcbiAgICBjb250ZW50OiB7XG4gICAgICAgIHRpdGxlPzogc3RyaW5nLFxuICAgICAgICBzdWJ0aXRsZT86IHN0cmluZyxcbiAgICAgICAgdGV4dD86IHN0cmluZyxcbiAgICAgICAgaW1hZ2VzPzogQ2FyZEltYWdlW10sXG4gICAgICAgIGJ1dHRvbnM/OiBDYXJkQWN0aW9uW10sXG4gICAgICAgIHRhcD86IENhcmRBY3Rpb25cbiAgICB9XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgU2lnbmluIHtcbiAgICBjb250ZW50VHlwZTogXCJhcHBsaWNhdGlvbi92bmQubWljcm9zb2Z0LmNhcmQuc2lnbmluXCIsXG4gICAgY29udGVudDoge1xuICAgICAgICB0ZXh0Pzogc3RyaW5nLFxuICAgICAgICBidXR0b25zPzogQ2FyZEFjdGlvbltdXG4gICAgfVxufVxuXG5leHBvcnQgaW50ZXJmYWNlIE9BdXRoIHtcbiAgICBjb250ZW50VHlwZTogXCJhcHBsaWNhdGlvbi92bmQubWljcm9zb2Z0LmNhcmQub2F1dGhcIixcbiAgICBjb250ZW50OiB7XG4gICAgICAgIHRleHQ/OiBzdHJpbmcsXG4gICAgICAgIGNvbm5lY3Rpb25uYW1lOiBzdHJpbmcsXG4gICAgICAgIGJ1dHRvbnM/OiBDYXJkQWN0aW9uW11cbiAgICB9XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUmVjZWlwdEl0ZW0ge1xuICAgIHRpdGxlPzogc3RyaW5nLFxuICAgIHN1YnRpdGxlPzogc3RyaW5nLFxuICAgIHRleHQ/OiBzdHJpbmcsXG4gICAgaW1hZ2U/OiBDYXJkSW1hZ2UsXG4gICAgcHJpY2U/OiBzdHJpbmcsXG4gICAgcXVhbnRpdHk/OiBzdHJpbmcsXG4gICAgdGFwPzogQ2FyZEFjdGlvblxufVxuXG5leHBvcnQgaW50ZXJmYWNlIFJlY2VpcHQge1xuICAgIGNvbnRlbnRUeXBlOiBcImFwcGxpY2F0aW9uL3ZuZC5taWNyb3NvZnQuY2FyZC5yZWNlaXB0XCIsXG4gICAgY29udGVudDoge1xuICAgICAgICB0aXRsZT86IHN0cmluZyxcbiAgICAgICAgZmFjdHM/OiB7IGtleTogc3RyaW5nLCB2YWx1ZTogc3RyaW5nIH1bXSxcbiAgICAgICAgaXRlbXM/OiBSZWNlaXB0SXRlbVtdLFxuICAgICAgICB0YXA/OiBDYXJkQWN0aW9uLFxuICAgICAgICB0YXg/OiBzdHJpbmcsXG4gICAgICAgIHZhdD86IHN0cmluZyxcbiAgICAgICAgdG90YWw/OiBzdHJpbmcsXG4gICAgICAgIGJ1dHRvbnM/OiBDYXJkQWN0aW9uW11cbiAgICB9XG59XG5cbi8vIERlcHJlY2F0ZWQgZm9ybWF0IGZvciBTa3lwZSBjaGFubmVscy4gRm9yIHRlc3RpbmcgbGVnYWN5IGJvdHMgaW4gRW11bGF0b3Igb25seS5cbmV4cG9ydCBpbnRlcmZhY2UgRmxleENhcmQge1xuICAgIGNvbnRlbnRUeXBlOiBcImFwcGxpY2F0aW9uL3ZuZC5taWNyb3NvZnQuY2FyZC5mbGV4XCIsXG4gICAgY29udGVudDoge1xuICAgICAgICB0aXRsZT86IHN0cmluZyxcbiAgICAgICAgc3VidGl0bGU/OiBzdHJpbmcsXG4gICAgICAgIHRleHQ/OiBzdHJpbmcsXG4gICAgICAgIGltYWdlcz86IENhcmRJbWFnZVtdLFxuICAgICAgICBidXR0b25zPzogQ2FyZEFjdGlvbltdLFxuICAgICAgICBhc3BlY3Q/OiBzdHJpbmdcbiAgICB9XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgQXVkaW9DYXJkIHtcbiAgICBjb250ZW50VHlwZTogXCJhcHBsaWNhdGlvbi92bmQubWljcm9zb2Z0LmNhcmQuYXVkaW9cIixcbiAgICBjb250ZW50OiB7XG4gICAgICAgIHRpdGxlPzogc3RyaW5nLFxuICAgICAgICBzdWJ0aXRsZT86IHN0cmluZyxcbiAgICAgICAgdGV4dD86IHN0cmluZyxcbiAgICAgICAgbWVkaWE/OiB7IHVybDogc3RyaW5nLCBwcm9maWxlPzogc3RyaW5nIH1bXSxcbiAgICAgICAgYnV0dG9ucz86IENhcmRBY3Rpb25bXSxcbiAgICAgICAgYXV0b2xvb3A/OiBib29sZWFuLFxuICAgICAgICBhdXRvc3RhcnQ/OiBib29sZWFuXG4gICAgfVxufVxuXG5leHBvcnQgaW50ZXJmYWNlIFZpZGVvQ2FyZCB7XG4gICAgY29udGVudFR5cGU6IFwiYXBwbGljYXRpb24vdm5kLm1pY3Jvc29mdC5jYXJkLnZpZGVvXCIsXG4gICAgY29udGVudDoge1xuICAgICAgICB0aXRsZT86IHN0cmluZyxcbiAgICAgICAgc3VidGl0bGU/OiBzdHJpbmcsXG4gICAgICAgIHRleHQ/OiBzdHJpbmcsXG4gICAgICAgIG1lZGlhPzogeyB1cmw6IHN0cmluZywgcHJvZmlsZT86IHN0cmluZyB9W10sXG4gICAgICAgIGJ1dHRvbnM/OiBDYXJkQWN0aW9uW10sXG4gICAgICAgIGltYWdlPzogeyB1cmw6IHN0cmluZywgYWx0Pzogc3RyaW5nIH0sXG4gICAgICAgIGF1dG9sb29wPzogYm9vbGVhbixcbiAgICAgICAgYXV0b3N0YXJ0PzogYm9vbGVhblxuICAgIH1cbn1cblxuZXhwb3J0IGludGVyZmFjZSBBZGFwdGl2ZUNhcmQge1xuICAgIGNvbnRlbnRUeXBlOiBcImFwcGxpY2F0aW9uL3ZuZC5taWNyb3NvZnQuY2FyZC5hZGFwdGl2ZVwiLFxuICAgIGNvbnRlbnQ6IGFueTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBBbmltYXRpb25DYXJkIHtcbiAgICBjb250ZW50VHlwZTogXCJhcHBsaWNhdGlvbi92bmQubWljcm9zb2Z0LmNhcmQuYW5pbWF0aW9uXCIsXG4gICAgY29udGVudDoge1xuICAgICAgICB0aXRsZT86IHN0cmluZyxcbiAgICAgICAgc3VidGl0bGU/OiBzdHJpbmcsXG4gICAgICAgIHRleHQ/OiBzdHJpbmcsXG4gICAgICAgIG1lZGlhPzogeyB1cmw6IHN0cmluZywgcHJvZmlsZT86IHN0cmluZyB9W10sXG4gICAgICAgIGJ1dHRvbnM/OiBDYXJkQWN0aW9uW10sXG4gICAgICAgIGltYWdlPzogeyB1cmw6IHN0cmluZywgYWx0Pzogc3RyaW5nIH0sXG4gICAgICAgIGF1dG9sb29wPzogYm9vbGVhbixcbiAgICAgICAgYXV0b3N0YXJ0PzogYm9vbGVhblxuICAgIH1cbn1cblxuZXhwb3J0IHR5cGUgS25vd25NZWRpYSA9IE1lZGlhIHwgSGVyb0NhcmQgfCBUaHVtYm5haWwgfCBTaWduaW4gfCBPQXV0aCB8IFJlY2VpcHQgfCBBdWRpb0NhcmQgfCBWaWRlb0NhcmQgfCBBbmltYXRpb25DYXJkIHwgRmxleENhcmQgfCBBZGFwdGl2ZUNhcmQ7XG5leHBvcnQgdHlwZSBBdHRhY2htZW50ID0gS25vd25NZWRpYSB8IFVua25vd25NZWRpYTtcblxuZXhwb3J0IHR5cGUgVXNlclJvbGUgPSBcImJvdFwiIHwgXCJjaGFubmVsXCIgfCBcInVzZXJcIjtcblxuZXhwb3J0IGludGVyZmFjZSBVc2VyIHtcbiAgICBpZDogc3RyaW5nLFxuICAgIG5hbWU/OiBzdHJpbmcsXG4gICAgaWNvblVybD86IHN0cmluZyxcbiAgICByb2xlPzogVXNlclJvbGVcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJQWN0aXZpdHkge1xuICAgIHR5cGU6IHN0cmluZyxcbiAgICBjaGFubmVsRGF0YT86IGFueSxcbiAgICBjaGFubmVsSWQ/OiBzdHJpbmcsXG4gICAgY29udmVyc2F0aW9uPzogeyBpZDogc3RyaW5nIH0sXG4gICAgZVRhZz86IHN0cmluZyxcbiAgICBmcm9tOiBVc2VyLFxuICAgIGlkPzogc3RyaW5nLFxuICAgIHRpbWVzdGFtcD86IHN0cmluZ1xufVxuXG5leHBvcnQgdHlwZSBBdHRhY2htZW50TGF5b3V0ID0gXCJsaXN0XCIgfCBcImNhcm91c2VsXCI7XG5cbmV4cG9ydCBpbnRlcmZhY2UgTWVzc2FnZSBleHRlbmRzIElBY3Rpdml0eSB7XG4gICAgdHlwZTogXCJtZXNzYWdlXCIsXG4gICAgdGV4dD86IHN0cmluZyxcbiAgICBsb2NhbGU/OiBzdHJpbmcsXG4gICAgdGV4dEZvcm1hdD86IFwicGxhaW5cIiB8IFwibWFya2Rvd25cIiB8IFwieG1sXCIsXG4gICAgYXR0YWNobWVudExheW91dD86IEF0dGFjaG1lbnRMYXlvdXQsXG4gICAgYXR0YWNobWVudHM/OiBBdHRhY2htZW50W10sXG4gICAgZW50aXRpZXM/OiBhbnlbXSxcbiAgICBzdWdnZXN0ZWRBY3Rpb25zPzogeyBhY3Rpb25zOiBDYXJkQWN0aW9uW10sIHRvPzogc3RyaW5nW10gfSxcbiAgICBzcGVhaz86IHN0cmluZyxcbiAgICBpbnB1dEhpbnQ/OiBzdHJpbmcsXG4gICAgdmFsdWU/OiBvYmplY3Rcbn1cblxuZXhwb3J0IGludGVyZmFjZSBUeXBpbmcgZXh0ZW5kcyBJQWN0aXZpdHkge1xuICAgIHR5cGU6IFwidHlwaW5nXCJcbn1cblxuZXhwb3J0IGludGVyZmFjZSBFdmVudEFjdGl2aXR5IGV4dGVuZHMgSUFjdGl2aXR5IHtcbiAgICB0eXBlOiBcImV2ZW50XCIsXG4gICAgbmFtZTogc3RyaW5nLFxuICAgIHZhbHVlOiBhbnlcbn1cblxuZXhwb3J0IHR5cGUgQWN0aXZpdHkgPSBNZXNzYWdlIHwgVHlwaW5nIHwgRXZlbnRBY3Rpdml0eTtcblxuaW50ZXJmYWNlIEFjdGl2aXR5R3JvdXAge1xuICAgIGFjdGl2aXRpZXM6IEFjdGl2aXR5W10sXG4gICAgd2F0ZXJtYXJrOiBzdHJpbmdcbn1cblxuLy8gVGhlc2UgdHlwZXMgYXJlIHNwZWNpZmljIHRvIHRoaXMgY2xpZW50IGxpYnJhcnksIG5vdCB0byBEaXJlY3QgTGluZSAzLjBcblxuZXhwb3J0IGVudW0gQ29ubmVjdGlvblN0YXR1cyB7XG4gICAgVW5pbml0aWFsaXplZCwgICAgICAgICAgICAgIC8vIHRoZSBzdGF0dXMgd2hlbiB0aGUgRGlyZWN0TGluZSBvYmplY3QgaXMgZmlyc3QgY3JlYXRlZC9jb25zdHJ1Y3RlZFxuICAgIENvbm5lY3RpbmcsICAgICAgICAgICAgICAgICAvLyBjdXJyZW50bHkgdHJ5aW5nIHRvIGNvbm5lY3QgdG8gdGhlIGNvbnZlcnNhdGlvblxuICAgIE9ubGluZSwgICAgICAgICAgICAgICAgICAgICAvLyBzdWNjZXNzZnVsbHkgY29ubmVjdGVkIHRvIHRoZSBjb252ZXJzdGFpb24uIENvbm5lY3Rpb24gaXMgaGVhbHRoeSBzbyBmYXIgYXMgd2Uga25vdy5cbiAgICBFeHBpcmVkVG9rZW4sICAgICAgICAgICAgICAgLy8gbGFzdCBvcGVyYXRpb24gZXJyb3JlZCBvdXQgd2l0aCBhbiBleHBpcmVkIHRva2VuLiBQb3NzaWJseSB3YWl0aW5nIGZvciBzb21lb25lIHRvIHN1cHBseSBhIG5ldyBvbmUuXG4gICAgRmFpbGVkVG9Db25uZWN0LCAgICAgICAgICAgIC8vIHRoZSBpbml0aWFsIGF0dGVtcHQgdG8gY29ubmVjdCB0byB0aGUgY29udmVyc2F0aW9uIGZhaWxlZC4gTm8gcmVjb3ZlcnkgcG9zc2libGUuXG4gICAgRW5kZWQgICAgICAgICAgICAgICAgICAgICAgIC8vIHRoZSBib3QgZW5kZWQgdGhlIGNvbnZlcnNhdGlvblxufVxuXG5leHBvcnQgaW50ZXJmYWNlIERpcmVjdExpbmVPcHRpb25zIHtcbiAgICBzZWNyZXQ/OiBzdHJpbmcsXG4gICAgdG9rZW4/OiBzdHJpbmcsXG4gICAgY29udmVyc2F0aW9uSWQ/OiBzdHJpbmcsXG4gICAgd2F0ZXJtYXJrPzogc3RyaW5nLFxuICAgIGRvbWFpbj86IHN0cmluZyxcbiAgICB3ZWJTb2NrZXQ/OiBib29sZWFuLFxuICAgIHBvbGxpbmdJbnRlcnZhbD86IG51bWJlcixcbiAgICBzdHJlYW1Vcmw/OiBzdHJpbmdcbn1cblxuY29uc3QgbGlmZXRpbWVSZWZyZXNoVG9rZW4gPSAzMCAqIDYwICogMTAwMDtcbmNvbnN0IGludGVydmFsUmVmcmVzaFRva2VuID0gbGlmZXRpbWVSZWZyZXNoVG9rZW4gLyAyO1xuY29uc3QgdGltZW91dCA9IDIwICogMTAwMDtcbmNvbnN0IHJldHJpZXMgPSAobGlmZXRpbWVSZWZyZXNoVG9rZW4gLSBpbnRlcnZhbFJlZnJlc2hUb2tlbikgLyB0aW1lb3V0O1xuXG5jb25zdCBlcnJvckV4cGlyZWRUb2tlbiA9IG5ldyBFcnJvcihcImV4cGlyZWQgdG9rZW5cIik7XG5jb25zdCBlcnJvckNvbnZlcnNhdGlvbkVuZGVkID0gbmV3IEVycm9yKFwiY29udmVyc2F0aW9uIGVuZGVkXCIpO1xuY29uc3QgZXJyb3JGYWlsZWRUb0Nvbm5lY3QgPSBuZXcgRXJyb3IoXCJmYWlsZWQgdG8gY29ubmVjdFwiKTtcblxuY29uc3Qga29uc29sZSA9IHtcbiAgICBsb2c6IChtZXNzYWdlPzogYW55LCAuLi4gb3B0aW9uYWxQYXJhbXM6IGFueVtdKSA9PiB7XG4gICAgICAgIGlmICh0eXBlb2Yod2luZG93KSAhPT0gJ3VuZGVmaW5lZCcgJiYgd2luZG93W1wiYm90Y2hhdERlYnVnXCJdICYmIG1lc3NhZ2UpXG4gICAgICAgICAgICBjb25zb2xlLmxvZyhtZXNzYWdlLCAuLi4gb3B0aW9uYWxQYXJhbXMpO1xuICAgIH1cbn1cblxuZXhwb3J0IGludGVyZmFjZSBJQm90Q29ubmVjdGlvbiB7XG4gICAgY29ubmVjdGlvblN0YXR1cyQ6IEJlaGF2aW9yU3ViamVjdDxDb25uZWN0aW9uU3RhdHVzPixcbiAgICBhY3Rpdml0eSQ6IE9ic2VydmFibGU8QWN0aXZpdHk+LFxuICAgIGVuZCgpOiB2b2lkLFxuICAgIHJlZmVyZW5jZUdyYW1tYXJJZD86IHN0cmluZyxcbiAgICBwb3N0QWN0aXZpdHkoYWN0aXZpdHk6IEFjdGl2aXR5KTogT2JzZXJ2YWJsZTxzdHJpbmc+LFxuICAgIGdldFNlc3Npb25JZD8gOiAoKSA9PiBPYnNlcnZhYmxlPHN0cmluZz5cbn1cblxuZXhwb3J0IGNsYXNzIERpcmVjdExpbmUgaW1wbGVtZW50cyBJQm90Q29ubmVjdGlvbiB7XG4gICAgcHVibGljIGNvbm5lY3Rpb25TdGF0dXMkID0gbmV3IEJlaGF2aW9yU3ViamVjdChDb25uZWN0aW9uU3RhdHVzLlVuaW5pdGlhbGl6ZWQpO1xuICAgIHB1YmxpYyBhY3Rpdml0eSQ6IE9ic2VydmFibGU8QWN0aXZpdHk+O1xuXG4gICAgcHJpdmF0ZSBkb21haW4gPSBcImh0dHBzOi8vZGlyZWN0bGluZS5ib3RmcmFtZXdvcmsuY29tL3YzL2RpcmVjdGxpbmVcIjtcbiAgICBwcml2YXRlIHdlYlNvY2tldDtcblxuICAgIHByaXZhdGUgY29udmVyc2F0aW9uSWQ6IHN0cmluZztcbiAgICBwcml2YXRlIHNlY3JldDogc3RyaW5nO1xuICAgIHByaXZhdGUgdG9rZW46IHN0cmluZztcbiAgICBwcml2YXRlIHdhdGVybWFyayA9ICcnO1xuICAgIHByaXZhdGUgc3RyZWFtVXJsOiBzdHJpbmc7XG4gICAgcHVibGljIHJlZmVyZW5jZUdyYW1tYXJJZDogc3RyaW5nO1xuXG4gICAgcHJpdmF0ZSBwb2xsaW5nSW50ZXJ2YWw6IG51bWJlciA9IDEwMDA7XG5cbiAgICBwcml2YXRlIHRva2VuUmVmcmVzaFN1YnNjcmlwdGlvbjogU3Vic2NyaXB0aW9uO1xuXG4gICAgY29uc3RydWN0b3Iob3B0aW9uczogRGlyZWN0TGluZU9wdGlvbnMpIHtcbiAgICAgICAgdGhpcy5zZWNyZXQgPSBvcHRpb25zLnNlY3JldDtcbiAgICAgICAgdGhpcy50b2tlbiA9IG9wdGlvbnMuc2VjcmV0IHx8IG9wdGlvbnMudG9rZW47XG4gICAgICAgIHRoaXMud2ViU29ja2V0ID0gKG9wdGlvbnMud2ViU29ja2V0ID09PSB1bmRlZmluZWQgPyB0cnVlIDogb3B0aW9ucy53ZWJTb2NrZXQpICYmIHR5cGVvZiBXZWJTb2NrZXQgIT09ICd1bmRlZmluZWQnICYmIFdlYlNvY2tldCAhPT0gdW5kZWZpbmVkO1xuXG4gICAgICAgIGlmIChvcHRpb25zLmRvbWFpbilcbiAgICAgICAgICAgIHRoaXMuZG9tYWluID0gb3B0aW9ucy5kb21haW47XG4gICAgICAgIGlmIChvcHRpb25zLmNvbnZlcnNhdGlvbklkKSB7XG4gICAgICAgICAgICB0aGlzLmNvbnZlcnNhdGlvbklkID0gb3B0aW9ucy5jb252ZXJzYXRpb25JZDtcbiAgICAgICAgfVxuICAgICAgICBpZiAob3B0aW9ucy53YXRlcm1hcmspIHtcbiAgICAgICAgICAgIGlmICh0aGlzLndlYlNvY2tldClcbiAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4oXCJXYXRlcm1hcmsgd2FzIGlnbm9yZWQ6IGl0IGlzIG5vdCBzdXBwb3J0ZWQgdXNpbmcgd2Vic29ja2V0cyBhdCB0aGUgbW9tZW50XCIpO1xuICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAgICAgIHRoaXMud2F0ZXJtYXJrID0gIG9wdGlvbnMud2F0ZXJtYXJrO1xuICAgICAgICB9XG4gICAgICAgIGlmIChvcHRpb25zLnN0cmVhbVVybCkge1xuICAgICAgICAgICAgaWYgKG9wdGlvbnMudG9rZW4gJiYgb3B0aW9ucy5jb252ZXJzYXRpb25JZClcbiAgICAgICAgICAgICAgICB0aGlzLnN0cmVhbVVybCA9IG9wdGlvbnMuc3RyZWFtVXJsO1xuICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybihcInN0cmVhbVVybCB3YXMgaWdub3JlZDogeW91IG5lZWQgdG8gcHJvdmlkZSBhIHRva2VuIGFuZCBhIGNvbnZlcnNhdGlvbmlkXCIpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChvcHRpb25zLnBvbGxpbmdJbnRlcnZhbCAhPT0gdW5kZWZpbmVkKVxuICAgICAgICAgICAgdGhpcy5wb2xsaW5nSW50ZXJ2YWwgPSBvcHRpb25zLnBvbGxpbmdJbnRlcnZhbDtcblxuICAgICAgICB0aGlzLmFjdGl2aXR5JCA9ICh0aGlzLndlYlNvY2tldFxuICAgICAgICAgICAgPyB0aGlzLndlYlNvY2tldEFjdGl2aXR5JCgpXG4gICAgICAgICAgICA6IHRoaXMucG9sbGluZ0dldEFjdGl2aXR5JCgpXG4gICAgICAgICkuc2hhcmUoKTtcbiAgICB9XG5cbiAgICAvLyBFdmVyeSB0aW1lIHdlJ3JlIGFib3V0IHRvIG1ha2UgYSBEaXJlY3QgTGluZSBSRVNUIGNhbGwsIHdlIGNhbGwgdGhpcyBmaXJzdCB0byBzZWUgY2hlY2sgdGhlIGN1cnJlbnQgY29ubmVjdGlvbiBzdGF0dXMuXG4gICAgLy8gRWl0aGVyIHRocm93cyBhbiBlcnJvciAoaW5kaWNhdGluZyBhbiBlcnJvciBzdGF0ZSkgb3IgZW1pdHMgYSBudWxsLCBpbmRpY2F0aW5nIGEgKHByZXN1bWFibHkpIGhlYWx0aHkgY29ubmVjdGlvblxuICAgIHByaXZhdGUgY2hlY2tDb25uZWN0aW9uKG9uY2UgPSBmYWxzZSkge1xuICAgICAgICBsZXQgb2JzID0gIHRoaXMuY29ubmVjdGlvblN0YXR1cyRcbiAgICAgICAgLmZsYXRNYXAoY29ubmVjdGlvblN0YXR1cyA9PiB7XG4gICAgICAgICAgICBpZiAoY29ubmVjdGlvblN0YXR1cyA9PT0gQ29ubmVjdGlvblN0YXR1cy5VbmluaXRpYWxpemVkKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5jb25uZWN0aW9uU3RhdHVzJC5uZXh0KENvbm5lY3Rpb25TdGF0dXMuQ29ubmVjdGluZyk7XG5cbiAgICAgICAgICAgICAgICAvL2lmIHRva2VuIGFuZCBzdHJlYW1VcmwgYXJlIGRlZmluZWQgaXQgbWVhbnMgcmVjb25uZWN0IGhhcyBhbHJlYWR5IGJlZW4gZG9uZS4gU2tpcHBpbmcgaXQuXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMudG9rZW4gJiYgdGhpcy5zdHJlYW1VcmwpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5jb25uZWN0aW9uU3RhdHVzJC5uZXh0KENvbm5lY3Rpb25TdGF0dXMuT25saW5lKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIE9ic2VydmFibGUub2YoY29ubmVjdGlvblN0YXR1cyk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuc3RhcnRDb252ZXJzYXRpb24oKS5kbyhjb252ZXJzYXRpb24gPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5jb252ZXJzYXRpb25JZCA9IGNvbnZlcnNhdGlvbi5jb252ZXJzYXRpb25JZDtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMudG9rZW4gPSB0aGlzLnNlY3JldCB8fCBjb252ZXJzYXRpb24udG9rZW47XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnN0cmVhbVVybCA9IGNvbnZlcnNhdGlvbi5zdHJlYW1Vcmw7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnJlZmVyZW5jZUdyYW1tYXJJZCA9IGNvbnZlcnNhdGlvbi5yZWZlcmVuY2VHcmFtbWFySWQ7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIXRoaXMuc2VjcmV0KVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucmVmcmVzaFRva2VuTG9vcCgpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmNvbm5lY3Rpb25TdGF0dXMkLm5leHQoQ29ubmVjdGlvblN0YXR1cy5PbmxpbmUpO1xuICAgICAgICAgICAgICAgICAgICB9LCBlcnJvciA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmNvbm5lY3Rpb25TdGF0dXMkLm5leHQoQ29ubmVjdGlvblN0YXR1cy5GYWlsZWRUb0Nvbm5lY3QpO1xuICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICAubWFwKF8gPT4gY29ubmVjdGlvblN0YXR1cyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIE9ic2VydmFibGUub2YoY29ubmVjdGlvblN0YXR1cyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pXG4gICAgICAgIC5maWx0ZXIoY29ubmVjdGlvblN0YXR1cyA9PiBjb25uZWN0aW9uU3RhdHVzICE9IENvbm5lY3Rpb25TdGF0dXMuVW5pbml0aWFsaXplZCAmJiBjb25uZWN0aW9uU3RhdHVzICE9IENvbm5lY3Rpb25TdGF0dXMuQ29ubmVjdGluZylcbiAgICAgICAgLmZsYXRNYXAoY29ubmVjdGlvblN0YXR1cyA9PiB7XG4gICAgICAgICAgICBzd2l0Y2ggKGNvbm5lY3Rpb25TdGF0dXMpIHtcbiAgICAgICAgICAgICAgICBjYXNlIENvbm5lY3Rpb25TdGF0dXMuRW5kZWQ6XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBPYnNlcnZhYmxlLnRocm93KGVycm9yQ29udmVyc2F0aW9uRW5kZWQpO1xuXG4gICAgICAgICAgICAgICAgY2FzZSBDb25uZWN0aW9uU3RhdHVzLkZhaWxlZFRvQ29ubmVjdDpcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIE9ic2VydmFibGUudGhyb3coZXJyb3JGYWlsZWRUb0Nvbm5lY3QpO1xuXG4gICAgICAgICAgICAgICAgY2FzZSBDb25uZWN0aW9uU3RhdHVzLkV4cGlyZWRUb2tlbjpcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIE9ic2VydmFibGUudGhyb3coZXJyb3JFeHBpcmVkVG9rZW4pO1xuXG4gICAgICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIE9ic2VydmFibGUub2YobnVsbCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pXG5cbiAgICAgICAgcmV0dXJuIG9uY2UgPyBvYnMudGFrZSgxKSA6IG9icztcbiAgICB9XG5cbiAgICBwcml2YXRlIGV4cGlyZWRUb2tlbigpIHtcbiAgICAgICAgY29uc3QgY29ubmVjdGlvblN0YXR1cyA9IHRoaXMuY29ubmVjdGlvblN0YXR1cyQuZ2V0VmFsdWUoKTtcbiAgICAgICAgaWYgKGNvbm5lY3Rpb25TdGF0dXMgIT0gQ29ubmVjdGlvblN0YXR1cy5FbmRlZCAmJiBjb25uZWN0aW9uU3RhdHVzICE9IENvbm5lY3Rpb25TdGF0dXMuRmFpbGVkVG9Db25uZWN0KVxuICAgICAgICAgICAgdGhpcy5jb25uZWN0aW9uU3RhdHVzJC5uZXh0KENvbm5lY3Rpb25TdGF0dXMuRXhwaXJlZFRva2VuKTtcbiAgICB9XG5cbiAgICBwcml2YXRlIHN0YXJ0Q29udmVyc2F0aW9uKCkge1xuICAgICAgICAvL2lmIGNvbnZlcnNhdGlvbmlkIGlzIHNldCBoZXJlLCBpdCBtZWFucyB3ZSBuZWVkIHRvIGNhbGwgdGhlIHJlY29ubmVjdCBhcGksIGVsc2UgaXQgaXMgYSBuZXcgY29udmVyc2F0aW9uXG4gICAgICAgIGNvbnN0IHVybCA9IHRoaXMuY29udmVyc2F0aW9uSWRcbiAgICAgICAgICAgID8gYCR7dGhpcy5kb21haW59L2NvbnZlcnNhdGlvbnMvJHt0aGlzLmNvbnZlcnNhdGlvbklkfT93YXRlcm1hcms9JHt0aGlzLndhdGVybWFya31gXG4gICAgICAgICAgICA6IGAke3RoaXMuZG9tYWlufS9jb252ZXJzYXRpb25zYDtcbiAgICAgICAgY29uc3QgbWV0aG9kID0gdGhpcy5jb252ZXJzYXRpb25JZCA/IFwiR0VUXCIgOiBcIlBPU1RcIjtcblxuICAgICAgICByZXR1cm4gT2JzZXJ2YWJsZS5hamF4KHtcbiAgICAgICAgICAgIG1ldGhvZCxcbiAgICAgICAgICAgIHVybCxcbiAgICAgICAgICAgIHRpbWVvdXQsXG4gICAgICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgICAgICAgXCJBY2NlcHRcIjogXCJhcHBsaWNhdGlvbi9qc29uXCIsXG4gICAgICAgICAgICAgICAgXCJBdXRob3JpemF0aW9uXCI6IGBCZWFyZXIgJHt0aGlzLnRva2VufWBcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSlcbi8vICAgICAgLmRvKGFqYXhSZXNwb25zZSA9PiBrb25zb2xlLmxvZyhcImNvbnZlcnNhdGlvbiBhamF4UmVzcG9uc2VcIiwgYWpheFJlc3BvbnNlLnJlc3BvbnNlKSlcbiAgICAgICAgLm1hcChhamF4UmVzcG9uc2UgPT4gYWpheFJlc3BvbnNlLnJlc3BvbnNlIGFzIENvbnZlcnNhdGlvbilcbiAgICAgICAgLnJldHJ5V2hlbihlcnJvciQgPT5cbiAgICAgICAgICAgIC8vIGZvciBub3cgd2UgZGVlbSA0eHggYW5kIDV4eCBlcnJvcnMgYXMgdW5yZWNvdmVyYWJsZVxuICAgICAgICAgICAgLy8gZm9yIGV2ZXJ5dGhpbmcgZWxzZSAodGltZW91dHMpLCByZXRyeSBmb3IgYSB3aGlsZVxuICAgICAgICAgICAgZXJyb3IkLm1lcmdlTWFwKGVycm9yID0+IGVycm9yLnN0YXR1cyA+PSA0MDAgJiYgZXJyb3Iuc3RhdHVzIDwgNjAwXG4gICAgICAgICAgICAgICAgPyBPYnNlcnZhYmxlLnRocm93KGVycm9yKVxuICAgICAgICAgICAgICAgIDogT2JzZXJ2YWJsZS5vZihlcnJvcilcbiAgICAgICAgICAgIClcbiAgICAgICAgICAgIC5kZWxheSh0aW1lb3V0KVxuICAgICAgICAgICAgLnRha2UocmV0cmllcylcbiAgICAgICAgKVxuICAgIH1cblxuICAgIHByaXZhdGUgcmVmcmVzaFRva2VuTG9vcCgpIHtcbiAgICAgICAgdGhpcy50b2tlblJlZnJlc2hTdWJzY3JpcHRpb24gPSBPYnNlcnZhYmxlLmludGVydmFsKGludGVydmFsUmVmcmVzaFRva2VuKVxuICAgICAgICAuZmxhdE1hcChfID0+IHRoaXMucmVmcmVzaFRva2VuKCkpXG4gICAgICAgIC5zdWJzY3JpYmUodG9rZW4gPT4ge1xuICAgICAgICAgICAga29uc29sZS5sb2coXCJyZWZyZXNoaW5nIHRva2VuXCIsIHRva2VuLCBcImF0XCIsIG5ldyBEYXRlKCkpO1xuICAgICAgICAgICAgdGhpcy50b2tlbiA9IHRva2VuO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBwcml2YXRlIHJlZnJlc2hUb2tlbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuY2hlY2tDb25uZWN0aW9uKHRydWUpXG4gICAgICAgIC5mbGF0TWFwKF8gPT5cbiAgICAgICAgICAgIE9ic2VydmFibGUuYWpheCh7XG4gICAgICAgICAgICAgICAgbWV0aG9kOiBcIlBPU1RcIixcbiAgICAgICAgICAgICAgICB1cmw6IGAke3RoaXMuZG9tYWlufS90b2tlbnMvcmVmcmVzaGAsXG4gICAgICAgICAgICAgICAgdGltZW91dCxcbiAgICAgICAgICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgICAgICAgICAgIFwiQXV0aG9yaXphdGlvblwiOiBgQmVhcmVyICR7dGhpcy50b2tlbn1gXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIC5tYXAoYWpheFJlc3BvbnNlID0+IGFqYXhSZXNwb25zZS5yZXNwb25zZS50b2tlbiBhcyBzdHJpbmcpXG4gICAgICAgICAgICAucmV0cnlXaGVuKGVycm9yJCA9PiBlcnJvciRcbiAgICAgICAgICAgICAgICAubWVyZ2VNYXAoZXJyb3IgPT4ge1xuICAgICAgICAgICAgICAgICAgICBpZiAoZXJyb3Iuc3RhdHVzID09PSA0MDMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGlmIHRoZSB0b2tlbiBpcyBleHBpcmVkIHRoZXJlJ3Mgbm8gcmVhc29uIHRvIGtlZXAgdHJ5aW5nXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmV4cGlyZWRUb2tlbigpO1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIE9ic2VydmFibGUudGhyb3coZXJyb3IpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBPYnNlcnZhYmxlLm9mKGVycm9yKTtcbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgIC5kZWxheSh0aW1lb3V0KVxuICAgICAgICAgICAgICAgIC50YWtlKHJldHJpZXMpXG4gICAgICAgICAgICApXG4gICAgICAgIClcbiAgICB9XG5cbiAgICBwdWJsaWMgcmVjb25uZWN0KGNvbnZlcnNhdGlvbjogQ29udmVyc2F0aW9uKSB7XG4gICAgICAgIHRoaXMudG9rZW4gPSBjb252ZXJzYXRpb24udG9rZW47XG4gICAgICAgIHRoaXMuc3RyZWFtVXJsID0gY29udmVyc2F0aW9uLnN0cmVhbVVybDtcbiAgICAgICAgaWYgKHRoaXMuY29ubmVjdGlvblN0YXR1cyQuZ2V0VmFsdWUoKSA9PT0gQ29ubmVjdGlvblN0YXR1cy5FeHBpcmVkVG9rZW4pXG4gICAgICAgICAgICB0aGlzLmNvbm5lY3Rpb25TdGF0dXMkLm5leHQoQ29ubmVjdGlvblN0YXR1cy5PbmxpbmUpO1xuICAgIH1cblxuICAgIGVuZCgpIHtcbiAgICAgICAgaWYgKHRoaXMudG9rZW5SZWZyZXNoU3Vic2NyaXB0aW9uKVxuICAgICAgICAgICAgdGhpcy50b2tlblJlZnJlc2hTdWJzY3JpcHRpb24udW5zdWJzY3JpYmUoKTtcbiAgICAgICAgdGhpcy5jb25uZWN0aW9uU3RhdHVzJC5uZXh0KENvbm5lY3Rpb25TdGF0dXMuRW5kZWQpO1xuICAgIH1cblxuICAgIGdldFNlc3Npb25JZCgpOiBPYnNlcnZhYmxlPHN0cmluZz4ge1xuICAgICAgICAvLyBJZiB3ZSdyZSBub3QgY29ubmVjdGVkIHRvIHRoZSBib3QsIGdldCBjb25uZWN0ZWRcbiAgICAgICAgLy8gV2lsbCB0aHJvdyBhbiBlcnJvciBpZiB3ZSBhcmUgbm90IGNvbm5lY3RlZFxuICAgICAgICBrb25zb2xlLmxvZyhcImdldFNlc3Npb25JZFwiKTtcbiAgICAgICAgcmV0dXJuIHRoaXMuY2hlY2tDb25uZWN0aW9uKHRydWUpXG4gICAgICAgICAgICAuZmxhdE1hcChfID0+XG4gICAgICAgICAgICAgICAgT2JzZXJ2YWJsZS5hamF4KHtcbiAgICAgICAgICAgICAgICAgICAgbWV0aG9kOiBcIkdFVFwiLFxuICAgICAgICAgICAgICAgICAgICB1cmw6IGAke3RoaXMuZG9tYWlufS9zZXNzaW9uL2dldHNlc3Npb25pZGAsXG4gICAgICAgICAgICAgICAgICAgIHdpdGhDcmVkZW50aWFsczogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgdGltZW91dCxcbiAgICAgICAgICAgICAgICAgICAgaGVhZGVyczoge1xuICAgICAgICAgICAgICAgICAgICAgICAgXCJDb250ZW50LVR5cGVcIjogXCJhcHBsaWNhdGlvbi9qc29uXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICBcIkF1dGhvcml6YXRpb25cIjogYEJlYXJlciAke3RoaXMudG9rZW59YFxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAubWFwKGFqYXhSZXNwb25zZSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChhamF4UmVzcG9uc2UgJiYgYWpheFJlc3BvbnNlLnJlc3BvbnNlICYmIGFqYXhSZXNwb25zZS5yZXNwb25zZS5zZXNzaW9uSWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGtvbnNvbGUubG9nKFwiZ2V0U2Vzc2lvbklkIHJlc3BvbnNlOiBcIiArIGFqYXhSZXNwb25zZS5yZXNwb25zZS5zZXNzaW9uSWQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGFqYXhSZXNwb25zZS5yZXNwb25zZS5zZXNzaW9uSWQgYXMgc3RyaW5nO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiAnJztcbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgIC5jYXRjaChlcnJvciA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGtvbnNvbGUubG9nKFwiZ2V0U2Vzc2lvbklkIGVycm9yOiBcIiArIGVycm9yLnN0YXR1cyk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBPYnNlcnZhYmxlLm9mKCcnKTtcbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgKVxuICAgICAgICAgICAgLmNhdGNoKGVycm9yID0+IHRoaXMuY2F0Y2hFeHBpcmVkVG9rZW4oZXJyb3IpKTtcbiAgICB9XG5cbiAgICBwb3N0QWN0aXZpdHkoYWN0aXZpdHk6IEFjdGl2aXR5KSB7XG4gICAgICAgIC8vIFVzZSBwb3N0TWVzc2FnZVdpdGhBdHRhY2htZW50cyBmb3IgbWVzc2FnZXMgd2l0aCBhdHRhY2htZW50cyB0aGF0IGFyZSBsb2NhbCBmaWxlcyAoZS5nLiBhbiBpbWFnZSB0byB1cGxvYWQpXG4gICAgICAgIC8vIFRlY2huaWNhbGx5IHdlIGNvdWxkIHVzZSBpdCBmb3IgKmFsbCogYWN0aXZpdGllcywgYnV0IHBvc3RBY3Rpdml0eSBpcyBtdWNoIGxpZ2h0ZXIgd2VpZ2h0XG4gICAgICAgIC8vIFNvLCBzaW5jZSBXZWJDaGF0IGlzIHBhcnRpYWxseSBhIHJlZmVyZW5jZSBpbXBsZW1lbnRhdGlvbiBvZiBEaXJlY3QgTGluZSwgd2UgaW1wbGVtZW50IGJvdGguXG4gICAgICAgIGlmIChhY3Rpdml0eS50eXBlID09PSBcIm1lc3NhZ2VcIiAmJiBhY3Rpdml0eS5hdHRhY2htZW50cyAmJiBhY3Rpdml0eS5hdHRhY2htZW50cy5sZW5ndGggPiAwKVxuICAgICAgICAgICAgcmV0dXJuIHRoaXMucG9zdE1lc3NhZ2VXaXRoQXR0YWNobWVudHMoYWN0aXZpdHkpO1xuXG4gICAgICAgIC8vIElmIHdlJ3JlIG5vdCBjb25uZWN0ZWQgdG8gdGhlIGJvdCwgZ2V0IGNvbm5lY3RlZFxuICAgICAgICAvLyBXaWxsIHRocm93IGFuIGVycm9yIGlmIHdlIGFyZSBub3QgY29ubmVjdGVkXG4gICAgICAgIGtvbnNvbGUubG9nKFwicG9zdEFjdGl2aXR5XCIsIGFjdGl2aXR5KTtcbiAgICAgICAgcmV0dXJuIHRoaXMuY2hlY2tDb25uZWN0aW9uKHRydWUpXG4gICAgICAgIC5mbGF0TWFwKF8gPT5cbiAgICAgICAgICAgIE9ic2VydmFibGUuYWpheCh7XG4gICAgICAgICAgICAgICAgbWV0aG9kOiBcIlBPU1RcIixcbiAgICAgICAgICAgICAgICB1cmw6IGAke3RoaXMuZG9tYWlufS9jb252ZXJzYXRpb25zLyR7dGhpcy5jb252ZXJzYXRpb25JZH0vYWN0aXZpdGllc2AsXG4gICAgICAgICAgICAgICAgYm9keTogYWN0aXZpdHksXG4gICAgICAgICAgICAgICAgdGltZW91dCxcbiAgICAgICAgICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgICAgICAgICAgIFwiQ29udGVudC1UeXBlXCI6IFwiYXBwbGljYXRpb24vanNvblwiLFxuICAgICAgICAgICAgICAgICAgICBcIkF1dGhvcml6YXRpb25cIjogYEJlYXJlciAke3RoaXMudG9rZW59YFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAubWFwKGFqYXhSZXNwb25zZSA9PiBhamF4UmVzcG9uc2UucmVzcG9uc2UuaWQgYXMgc3RyaW5nKVxuICAgICAgICAgICAgLmNhdGNoKGVycm9yID0+IHRoaXMuY2F0Y2hQb3N0RXJyb3IoZXJyb3IpKVxuICAgICAgICApXG4gICAgICAgIC5jYXRjaChlcnJvciA9PiB0aGlzLmNhdGNoRXhwaXJlZFRva2VuKGVycm9yKSk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBwb3N0TWVzc2FnZVdpdGhBdHRhY2htZW50cyh7IGF0dGFjaG1lbnRzLCAuLi4gbWVzc2FnZVdpdGhvdXRBdHRhY2htZW50cyB9OiBNZXNzYWdlKSB7XG4gICAgICAgIGxldCBmb3JtRGF0YTogRm9ybURhdGE7XG5cbiAgICAgICAgLy8gSWYgd2UncmUgbm90IGNvbm5lY3RlZCB0byB0aGUgYm90LCBnZXQgY29ubmVjdGVkXG4gICAgICAgIC8vIFdpbGwgdGhyb3cgYW4gZXJyb3IgaWYgd2UgYXJlIG5vdCBjb25uZWN0ZWRcbiAgICAgICAgcmV0dXJuIHRoaXMuY2hlY2tDb25uZWN0aW9uKHRydWUpXG4gICAgICAgIC5mbGF0TWFwKF8gPT4ge1xuICAgICAgICAgICAgLy8gVG8gc2VuZCB0aGlzIG1lc3NhZ2UgdG8gRGlyZWN0TGluZSB3ZSBuZWVkIHRvIGRlY29uc3RydWN0IGl0IGludG8gYSBcInRlbXBsYXRlXCIgYWN0aXZpdHlcbiAgICAgICAgICAgIC8vIGFuZCBvbmUgYmxvYiBmb3IgZWFjaCBhdHRhY2htZW50LlxuICAgICAgICAgICAgZm9ybURhdGEgPSBuZXcgRm9ybURhdGEoKTtcbiAgICAgICAgICAgIGZvcm1EYXRhLmFwcGVuZCgnYWN0aXZpdHknLCBuZXcgQmxvYihbSlNPTi5zdHJpbmdpZnkobWVzc2FnZVdpdGhvdXRBdHRhY2htZW50cyldLCB7IHR5cGU6ICdhcHBsaWNhdGlvbi92bmQubWljcm9zb2Z0LmFjdGl2aXR5JyB9KSk7XG5cbiAgICAgICAgICAgIHJldHVybiBPYnNlcnZhYmxlLmZyb20oYXR0YWNobWVudHMgfHwgW10pXG4gICAgICAgICAgICAuZmxhdE1hcCgobWVkaWE6IE1lZGlhKSA9PlxuICAgICAgICAgICAgICAgIE9ic2VydmFibGUuYWpheCh7XG4gICAgICAgICAgICAgICAgICAgIG1ldGhvZDogXCJHRVRcIixcbiAgICAgICAgICAgICAgICAgICAgdXJsOiBtZWRpYS5jb250ZW50VXJsLFxuICAgICAgICAgICAgICAgICAgICByZXNwb25zZVR5cGU6ICdhcnJheWJ1ZmZlcidcbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgIC5kbyhhamF4UmVzcG9uc2UgPT5cbiAgICAgICAgICAgICAgICAgICAgZm9ybURhdGEuYXBwZW5kKCdmaWxlJywgbmV3IEJsb2IoW2FqYXhSZXNwb25zZS5yZXNwb25zZV0sIHsgdHlwZTogbWVkaWEuY29udGVudFR5cGUgfSksIG1lZGlhLm5hbWUpXG4gICAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgKVxuICAgICAgICAgICAgLmNvdW50KClcbiAgICAgICAgfSlcbiAgICAgICAgLmZsYXRNYXAoXyA9PlxuICAgICAgICAgICAgT2JzZXJ2YWJsZS5hamF4KHtcbiAgICAgICAgICAgICAgICBtZXRob2Q6IFwiUE9TVFwiLFxuICAgICAgICAgICAgICAgIHVybDogYCR7dGhpcy5kb21haW59L2NvbnZlcnNhdGlvbnMvJHt0aGlzLmNvbnZlcnNhdGlvbklkfS91cGxvYWQ/dXNlcklkPSR7bWVzc2FnZVdpdGhvdXRBdHRhY2htZW50cy5mcm9tLmlkfWAsXG4gICAgICAgICAgICAgICAgYm9keTogZm9ybURhdGEsXG4gICAgICAgICAgICAgICAgdGltZW91dCxcbiAgICAgICAgICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgICAgICAgICAgIFwiQXV0aG9yaXphdGlvblwiOiBgQmVhcmVyICR7dGhpcy50b2tlbn1gXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIC5tYXAoYWpheFJlc3BvbnNlID0+IGFqYXhSZXNwb25zZS5yZXNwb25zZS5pZCBhcyBzdHJpbmcpXG4gICAgICAgICAgICAuY2F0Y2goZXJyb3IgPT4gdGhpcy5jYXRjaFBvc3RFcnJvcihlcnJvcikpXG4gICAgICAgIClcbiAgICAgICAgLmNhdGNoKGVycm9yID0+IHRoaXMuY2F0Y2hQb3N0RXJyb3IoZXJyb3IpKTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGNhdGNoUG9zdEVycm9yKGVycm9yOiBhbnkpIHtcbiAgICAgICAgaWYgKGVycm9yLnN0YXR1cyA9PT0gNDAzKVxuICAgICAgICAgICAgLy8gdG9rZW4gaGFzIGV4cGlyZWQgKHdpbGwgZmFsbCB0aHJvdWdoIHRvIHJldHVybiBcInJldHJ5XCIpXG4gICAgICAgICAgICB0aGlzLmV4cGlyZWRUb2tlbigpO1xuICAgICAgICBlbHNlIGlmIChlcnJvci5zdGF0dXMgPj0gNDAwICYmIGVycm9yLnN0YXR1cyA8IDUwMClcbiAgICAgICAgICAgIC8vIG1vcmUgdW5yZWNvdmVyYWJsZSBlcnJvcnNcbiAgICAgICAgICAgIHJldHVybiBPYnNlcnZhYmxlLnRocm93KGVycm9yKTtcbiAgICAgICAgcmV0dXJuIE9ic2VydmFibGUub2YoXCJyZXRyeVwiKTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGNhdGNoRXhwaXJlZFRva2VuKGVycm9yOiBhbnkpIHtcbiAgICAgICAgcmV0dXJuIGVycm9yID09PSBlcnJvckV4cGlyZWRUb2tlblxuICAgICAgICA/IE9ic2VydmFibGUub2YoXCJyZXRyeVwiKVxuICAgICAgICA6IE9ic2VydmFibGUudGhyb3coZXJyb3IpO1xuICAgIH1cblxuICAgIHByaXZhdGUgcG9sbGluZ0dldEFjdGl2aXR5JCgpIHtcbiAgICAgICAgcmV0dXJuIE9ic2VydmFibGUuaW50ZXJ2YWwodGhpcy5wb2xsaW5nSW50ZXJ2YWwpXG4gICAgICAgIC5jb21iaW5lTGF0ZXN0KHRoaXMuY2hlY2tDb25uZWN0aW9uKCkpXG4gICAgICAgIC5mbGF0TWFwKF8gPT5cbiAgICAgICAgICAgIE9ic2VydmFibGUuYWpheCh7XG4gICAgICAgICAgICAgICAgbWV0aG9kOiBcIkdFVFwiLFxuICAgICAgICAgICAgICAgIHVybDogYCR7dGhpcy5kb21haW59L2NvbnZlcnNhdGlvbnMvJHt0aGlzLmNvbnZlcnNhdGlvbklkfS9hY3Rpdml0aWVzP3dhdGVybWFyaz0ke3RoaXMud2F0ZXJtYXJrfWAsXG4gICAgICAgICAgICAgICAgdGltZW91dCxcbiAgICAgICAgICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgICAgICAgICAgIFwiQWNjZXB0XCI6IFwiYXBwbGljYXRpb24vanNvblwiLFxuICAgICAgICAgICAgICAgICAgICBcIkF1dGhvcml6YXRpb25cIjogYEJlYXJlciAke3RoaXMudG9rZW59YFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAuY2F0Y2goZXJyb3IgPT4ge1xuICAgICAgICAgICAgICAgIGlmIChlcnJvci5zdGF0dXMgPT09IDQwMykge1xuICAgICAgICAgICAgICAgICAgICAvLyBUaGlzIGlzIHNsaWdodGx5IHVnbHkuIFdlIHdhbnQgdG8gdXBkYXRlIHRoaXMuY29ubmVjdGlvblN0YXR1cyQgdG8gRXhwaXJlZFRva2VuIHNvIHRoYXQgc3Vic2VxdWVudFxuICAgICAgICAgICAgICAgICAgICAvLyBjYWxscyB0byBjaGVja0Nvbm5lY3Rpb24gd2lsbCB0aHJvdyBhbiBlcnJvci4gQnV0IHdoZW4gd2UgZG8gc28sIGl0IGNhdXNlcyB0aGlzLmNoZWNrQ29ubmVjdGlvbigpXG4gICAgICAgICAgICAgICAgICAgIC8vIHRvIGltbWVkaWF0ZWx5IHRocm93IGFuIGVycm9yLCB3aGljaCBpcyBjYXVnaHQgYnkgdGhlIGNhdGNoKCkgYmVsb3cgYW5kIHRyYW5zZm9ybWVkIGludG8gYW4gZW1wdHlcbiAgICAgICAgICAgICAgICAgICAgLy8gb2JqZWN0LiBUaGVuIG5leHQoKSByZXR1cm5zLCBhbmQgd2UgZW1pdCBhbiBlbXB0eSBvYmplY3QuIFdoaWNoIG1lYW5zIG9uZSA0MDMgaXMgY2F1c2luZ1xuICAgICAgICAgICAgICAgICAgICAvLyB0d28gZW1wdHkgb2JqZWN0cyB0byBiZSBlbWl0dGVkLiBXaGljaCBpcyBoYXJtbGVzcyBidXQsIGFnYWluLCBzbGlnaHRseSB1Z2x5LlxuICAgICAgICAgICAgICAgICAgICB0aGlzLmV4cGlyZWRUb2tlbigpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXR1cm4gT2JzZXJ2YWJsZS5lbXB0eTxBamF4UmVzcG9uc2U+KCk7XG4gICAgICAgICAgICB9KVxuLy8gICAgICAgICAgLmRvKGFqYXhSZXNwb25zZSA9PiBrb25zb2xlLmxvZyhcImdldEFjdGl2aXR5R3JvdXAgYWpheFJlc3BvbnNlXCIsIGFqYXhSZXNwb25zZSkpXG4gICAgICAgICAgICAubWFwKGFqYXhSZXNwb25zZSA9PiBhamF4UmVzcG9uc2UucmVzcG9uc2UgYXMgQWN0aXZpdHlHcm91cClcbiAgICAgICAgICAgIC5mbGF0TWFwKGFjdGl2aXR5R3JvdXAgPT4gdGhpcy5vYnNlcnZhYmxlRnJvbUFjdGl2aXR5R3JvdXAoYWN0aXZpdHlHcm91cCkpXG4gICAgICAgIClcbiAgICAgICAgLmNhdGNoKGVycm9yID0+IE9ic2VydmFibGUuZW1wdHk8QWN0aXZpdHk+KCkpO1xuICAgIH1cblxuICAgIHByaXZhdGUgb2JzZXJ2YWJsZUZyb21BY3Rpdml0eUdyb3VwKGFjdGl2aXR5R3JvdXA6IEFjdGl2aXR5R3JvdXApIHtcbiAgICAgICAgaWYgKGFjdGl2aXR5R3JvdXAud2F0ZXJtYXJrKVxuICAgICAgICAgICAgdGhpcy53YXRlcm1hcmsgPSBhY3Rpdml0eUdyb3VwLndhdGVybWFyaztcbiAgICAgICAgcmV0dXJuIE9ic2VydmFibGUuZnJvbShhY3Rpdml0eUdyb3VwLmFjdGl2aXRpZXMpO1xuICAgIH1cblxuICAgIHByaXZhdGUgd2ViU29ja2V0QWN0aXZpdHkkKCk6IE9ic2VydmFibGU8QWN0aXZpdHk+IHtcbiAgICAgICAgcmV0dXJuIHRoaXMuY2hlY2tDb25uZWN0aW9uKClcbiAgICAgICAgLmZsYXRNYXAoXyA9PlxuICAgICAgICAgICAgdGhpcy5vYnNlcnZhYmxlV2ViU29ja2V0PEFjdGl2aXR5R3JvdXA+KClcbiAgICAgICAgICAgIC8vIFdlYlNvY2tldHMgY2FuIGJlIGNsb3NlZCBieSB0aGUgc2VydmVyIG9yIHRoZSBicm93c2VyLiBJbiB0aGUgZm9ybWVyIGNhc2Ugd2UgbmVlZCB0b1xuICAgICAgICAgICAgLy8gcmV0cmlldmUgYSBuZXcgc3RyZWFtVXJsLiBJbiB0aGUgbGF0dGVyIGNhc2Ugd2UgY291bGQgZmlyc3QgcmV0cnkgd2l0aCB0aGUgY3VycmVudCBzdHJlYW1VcmwsXG4gICAgICAgICAgICAvLyBidXQgaXQncyBzaW1wbGVyIGp1c3QgdG8gYWx3YXlzIGZldGNoIGEgbmV3IG9uZS5cbiAgICAgICAgICAgIC5yZXRyeVdoZW4oZXJyb3IkID0+IGVycm9yJC5tZXJnZU1hcChlcnJvciA9PiB0aGlzLnJlY29ubmVjdFRvQ29udmVyc2F0aW9uKCkpKVxuICAgICAgICApXG4gICAgICAgIC5mbGF0TWFwKGFjdGl2aXR5R3JvdXAgPT4gdGhpcy5vYnNlcnZhYmxlRnJvbUFjdGl2aXR5R3JvdXAoYWN0aXZpdHlHcm91cCkpXG4gICAgfVxuXG4gICAgLy8gT3JpZ2luYWxseSB3ZSB1c2VkIE9ic2VydmFibGUud2ViU29ja2V0LCBidXQgaXQncyBmYWlybHkgb3Bpb25hdGVkICBhbmQgSSBlbmRlZCB1cCB3cml0aW5nXG4gICAgLy8gYSBsb3Qgb2YgY29kZSB0byB3b3JrIGFyb3VuZCB0aGVpciBpbXBsZW1lbnRpb24gZGV0YWlscy4gU2luY2UgV2ViQ2hhdCBpcyBtZWFudCB0byBiZSBhIHJlZmVyZW5jZVxuICAgIC8vIGltcGxlbWVudGF0aW9uLCBJIGRlY2lkZWQgcm9sbCB0aGUgYmVsb3csIHdoZXJlIHRoZSBsb2dpYyBpcyBtb3JlIHB1cnBvc2VmdWwuIC0gQGJpbGxiYVxuICAgIHByaXZhdGUgb2JzZXJ2YWJsZVdlYlNvY2tldDxUPigpIHtcbiAgICAgICAgcmV0dXJuIE9ic2VydmFibGUuY3JlYXRlKChzdWJzY3JpYmVyOiBTdWJzY3JpYmVyPFQ+KSA9PiB7XG4gICAgICAgICAgICBrb25zb2xlLmxvZyhcImNyZWF0aW5nIFdlYlNvY2tldFwiLCB0aGlzLnN0cmVhbVVybCk7XG4gICAgICAgICAgICBjb25zdCB3cyA9IG5ldyBXZWJTb2NrZXQodGhpcy5zdHJlYW1VcmwpO1xuICAgICAgICAgICAgbGV0IHN1YjogU3Vic2NyaXB0aW9uO1xuXG4gICAgICAgICAgICB3cy5vbm9wZW4gPSBvcGVuID0+IHtcbiAgICAgICAgICAgICAgICBrb25zb2xlLmxvZyhcIldlYlNvY2tldCBvcGVuXCIsIG9wZW4pO1xuICAgICAgICAgICAgICAgIC8vIENocm9tZSBpcyBwcmV0dHkgYmFkIGF0IG5vdGljaW5nIHdoZW4gYSBXZWJTb2NrZXQgY29ubmVjdGlvbiBpcyBicm9rZW4uXG4gICAgICAgICAgICAgICAgLy8gSWYgd2UgcGVyaW9kaWNhbGx5IHBpbmcgdGhlIHNlcnZlciB3aXRoIGVtcHR5IG1lc3NhZ2VzLCBpdCBoZWxwcyBDaHJvbWVcbiAgICAgICAgICAgICAgICAvLyByZWFsaXplIHdoZW4gY29ubmVjdGlvbiBicmVha3MsIGFuZCBjbG9zZSB0aGUgc29ja2V0LiBXZSB0aGVuIHRocm93IGFuXG4gICAgICAgICAgICAgICAgLy8gZXJyb3IsIGFuZCB0aGF0IGdpdmUgdXMgdGhlIG9wcG9ydHVuaXR5IHRvIGF0dGVtcHQgdG8gcmVjb25uZWN0LlxuICAgICAgICAgICAgICAgIHN1YiA9IE9ic2VydmFibGUuaW50ZXJ2YWwodGltZW91dCkuc3Vic2NyaWJlKF8gPT4gd3Muc2VuZChcIlwiKSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHdzLm9uY2xvc2UgPSBjbG9zZSA9PiB7XG4gICAgICAgICAgICAgICAga29uc29sZS5sb2coXCJXZWJTb2NrZXQgY2xvc2VcIiwgY2xvc2UpO1xuICAgICAgICAgICAgICAgIGlmIChzdWIpIHN1Yi51bnN1YnNjcmliZSgpO1xuICAgICAgICAgICAgICAgIHN1YnNjcmliZXIuZXJyb3IoY2xvc2UpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB3cy5vbm1lc3NhZ2UgPSBtZXNzYWdlID0+IG1lc3NhZ2UuZGF0YSAmJiBzdWJzY3JpYmVyLm5leHQoSlNPTi5wYXJzZShtZXNzYWdlLmRhdGEpKTtcblxuICAgICAgICAgICAgLy8gVGhpcyBpcyB0aGUgJ3Vuc3Vic2NyaWJlJyBtZXRob2QsIHdoaWNoIGlzIGNhbGxlZCB3aGVuIHRoaXMgb2JzZXJ2YWJsZSBpcyBkaXNwb3NlZC5cbiAgICAgICAgICAgIC8vIFdoZW4gdGhlIFdlYlNvY2tldCBjbG9zZXMgaXRzZWxmLCB3ZSB0aHJvdyBhbiBlcnJvciwgYW5kIHRoaXMgZnVuY3Rpb24gaXMgZXZlbnR1YWxseSBjYWxsZWQuXG4gICAgICAgICAgICAvLyBXaGVuIHRoZSBvYnNlcnZhYmxlIGlzIGNsb3NlZCBmaXJzdCAoZS5nLiB3aGVuIHRlYXJpbmcgZG93biBhIFdlYkNoYXQgaW5zdGFuY2UpIHRoZW5cbiAgICAgICAgICAgIC8vIHdlIG5lZWQgdG8gbWFudWFsbHkgY2xvc2UgdGhlIFdlYlNvY2tldC5cbiAgICAgICAgICAgIHJldHVybiAoKSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKHdzLnJlYWR5U3RhdGUgPT09IDAgfHwgd3MucmVhZHlTdGF0ZSA9PT0gMSkgd3MuY2xvc2UoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSkgYXMgT2JzZXJ2YWJsZTxUPlxuICAgIH1cblxuICAgIHByaXZhdGUgcmVjb25uZWN0VG9Db252ZXJzYXRpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmNoZWNrQ29ubmVjdGlvbih0cnVlKVxuICAgICAgICAuZmxhdE1hcChfID0+XG4gICAgICAgICAgICBPYnNlcnZhYmxlLmFqYXgoe1xuICAgICAgICAgICAgICAgIG1ldGhvZDogXCJHRVRcIixcbiAgICAgICAgICAgICAgICB1cmw6IGAke3RoaXMuZG9tYWlufS9jb252ZXJzYXRpb25zLyR7dGhpcy5jb252ZXJzYXRpb25JZH0/d2F0ZXJtYXJrPSR7dGhpcy53YXRlcm1hcmt9YCxcbiAgICAgICAgICAgICAgICB0aW1lb3V0LFxuICAgICAgICAgICAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgICAgICAgICAgICAgXCJBY2NlcHRcIjogXCJhcHBsaWNhdGlvbi9qc29uXCIsXG4gICAgICAgICAgICAgICAgICAgIFwiQXV0aG9yaXphdGlvblwiOiBgQmVhcmVyICR7dGhpcy50b2tlbn1gXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIC5kbyhyZXN1bHQgPT4ge1xuICAgICAgICAgICAgICAgIGlmICghdGhpcy5zZWNyZXQpXG4gICAgICAgICAgICAgICAgICAgIHRoaXMudG9rZW4gPSByZXN1bHQucmVzcG9uc2UudG9rZW47XG4gICAgICAgICAgICAgICAgdGhpcy5zdHJlYW1VcmwgPSByZXN1bHQucmVzcG9uc2Uuc3RyZWFtVXJsO1xuICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIC5tYXAoXyA9PiBudWxsKVxuICAgICAgICAgICAgLnJldHJ5V2hlbihlcnJvciQgPT4gZXJyb3IkXG4gICAgICAgICAgICAgICAgLm1lcmdlTWFwKGVycm9yID0+IHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGVycm9yLnN0YXR1cyA9PT0gNDAzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyB0b2tlbiBoYXMgZXhwaXJlZC4gV2UgY2FuJ3QgcmVjb3ZlciBmcm9tIHRoaXMgaGVyZSwgYnV0IHRoZSBlbWJlZGRpbmdcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIHdlYnNpdGUgbWlnaHQgZXZlbnR1YWxseSBjYWxsIHJlY29ubmVjdCgpIHdpdGggYSBuZXcgdG9rZW4gYW5kIHN0cmVhbVVybC5cbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZXhwaXJlZFRva2VuKCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIE9ic2VydmFibGUub2YoZXJyb3IpO1xuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgLmRlbGF5KHRpbWVvdXQpXG4gICAgICAgICAgICAgICAgLnRha2UocmV0cmllcylcbiAgICAgICAgICAgIClcbiAgICAgICAgKVxuICAgIH1cblxufVxuIl19