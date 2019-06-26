# testcafe-reporter-to-testrail
[![Build Status](https://travis-ci.org/futantan/testcafe-reporter-to-testrail.svg)](https://travis-ci.org/futantan/testcafe-reporter-to-testrail)

This is the **to-testrail** reporter plugin for [TestCafe](http://devexpress.github.io/testcafe).

<p align="center">
    <img src="https://raw.github.com/futantan/testcafe-reporter-to-testrail/master/media/preview.png" alt="preview" />
</p>

## Install

```
npm install testcafe-reporter-to-testrail
```

## Usage

When you run tests from the command line, specify the reporter name by using the `--reporter` option:

```
testcafe chrome 'path/to/test/file.js' --reporter to-testrail
```


When you use API, pass the reporter name to the `reporter()` method:

```js
testCafe
    .createRunner()
    .src('path/to/test/file.js')
    .browsers('chrome')
    .reporter('to-testrail') // <-
    .run();
```

## Author
Tantan Fu (http://x)
