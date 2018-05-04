# Introduction

*bracketslogger*  is an enhanced console logger with the following features:
- the primary reason for its existence - accurate line numbering (note: provided source mapping is working correctly!)
- object output in firefox/chrome browser console
- node `util.format()` compatible `sprintf()` style replacements
  - the library detects the context (browser, Android, ...) and replaces `%O` and/or `%j` with `JSON.stringify()` as needed
  - the library detects the context (browser, Android, ...) and combines comma arguments, to workaround how
    Android `console.log(A,B,C)` will only output `A`
- colourisation in both Firefox/Chrome and the Android logcat output
  - uses CSS in browser
  - uses `ansistyles` in Android logcat

*bracketslogger* combines the best parts of both the `debug` and `log-level` packages.
It is able to do this by sacrificing just a little bit of elegance - it produces accurate line numbers by returning a function
that must be called to produce the actual console log output. Hence the name, `bracketslogger`

There is also a very small performance hit because a new anonymous function is created for each log output.

*bracketslogger* comes with a tslint rule that will warn if the brackets are missing.
This wont help if you are using it from pure javascript however.
See http://github.com/platfarm-com/bracketslogger-tslint-rules.git

This library is being used in a real (proprietary) Android app under development.

# Usage

Typescript example:

```
import { Logging } from 'bracketslogger';
const Log = Logging.get('page.home');

// ...

Log.Debug('Hello, World')();
Log.Error('Something bad happened: %O', e)();
```

# TODO

There is a whole bunch of stuff missing, Contributions gratefully accepted!
- Unit test suite
- Minifcation
- Linting
  - the library itself
  - an eslint rule to detect missing brackets when used from pure javascript
- Robustness
  - I've only used it from Ionic3 in browser and Android webview
- Examples
- Improve how options are exposed to the caller
  - at the moment there is a dogy heiristic that switches behaviour between Android logcat and browser
  - there are options to turn on/off colourisation and prefixes, these need to be exposed
- Test in pure javascript - I've only tested from typescript
- Test what happens in iOS
- Test in Internet Explorer or Safari (only tested in Firefox, Chrome and logcat)
- Test in Android in situations other than Ionic/Cordova webview (chromium) output
- Test in node.js CLI

# Inspiration

I was frustrated at not having accurate line numbering of console output in the browser, but I liked how the use of
css to colour the results made it easy to pick various component logs out.

*bracketslogger* uses the bind mechanism used by `log-level` and the colour and substitution flexibility of `debug`.

- debug - https://www.npmjs.com/package/debug
- log-level - https://github.com/pimterry/loglevel

# License

Bracketslogger is licensed under the MPL (see https://www.mozilla.org/en-US/MPL/2.0/FAQ/

Briefly paraphrased, you can use Teuthis in a commercial setting, and the MPL does not have the "viral" component of the GPL. However _modifications_ to files _that are part of Teuthis_ that you wish to _redistribute_ (by using in a web page or hybrid mobile app) must be made available, and also cannot be re-licensed.

The easiest way to make available is to submit a pull request :-)

Please contact Platfarm (http://www.platfarm.com) to negotiate a commercial license if compliance with the MPL 2.0 license is does not fit your use case.

