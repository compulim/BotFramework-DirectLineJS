/// <reference path="../node_modules/@types/jest/index.d.ts" />

import { AjaxResponse, AjaxRequest } from 'rxjs/observable/dom/AjaxObservable';
import { ConnectionStatus, DirectLine } from '../src/directLine';
import { Observable } from 'rxjs/Observable';

const conversationId = ""+Math.random();

function getObject() {
var r = {response: {conversationId: conversationId}} as AjaxResponse
    console.log(r.response)
    return r
}

var MyOb = Observable.create((s) => {
    s.next(getObject())
    s.complete()
})

describe('Create conversation should set conversation ID', async () => {
it("hello", () => {

    const spy = jest.spyOn(Observable,"ajax").mockReturnValue(MyOb)


  try {
    var directLine = new DirectLine({
      domain: `http://localhost/v3/directline`,
      webSocket: false
    });


    const subscription = directLine.activity$.subscribe(() => {});

    expect(directLine).toHaveProperty('conversationId', 100);

    subscription.unsubscribe();
  } finally {
  }
  })
});
