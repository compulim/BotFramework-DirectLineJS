module.exports = {
  "setupFilesAfterEnv": [
    "<rootDir>/__tests__/setup/setupTestFramework.js"
  ],
  "testMatch": [
    "**/__tests__/**/*.[jt]s?(x)",
    "**/?(*.)(spec|test).[jt]s?(x)"
  ],
  "testPathIgnorePatterns": [
    "<rootDir>/__tests__/setup/"
  ],
  "transform": {
    "^.+\\.[jt]sx?$": "babel-jest"
  }
};
