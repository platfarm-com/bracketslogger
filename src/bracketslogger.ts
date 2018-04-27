import * as util from 'util';

declare var window: any;

function NOOP() {}

// tslint:disable-next-line
let DISABLE_PREFIX = false;

// tslint:disable-next-line
let NOT_BROWSER = false; // FIXME - set depending on if this is a Android (or iOS?) or a browser, etc.

let INSIDE_KARMA = false;

// Note: only reliable way to detect when running in live reload develoment on android is check the UA
// Because live reload is not serving from the device...
// ex. Samsung: Mozilla/5.0 (Linux; Android 6.0.1; SM-T350 Build/MMB29M; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/62.0.3202.84 Safari/537.36
// We can also try ((<any>window)['IonicDevServer'] != undefined) but that will disable colour in the web browser
let TRY_ANDROID = false;
let STYLE;
declare var require: any;
if ((document && document.URL && document.URL.startsWith('file')) || /wv/.test(window && window.navigator && window.navigator.userAgent)) {
  NOT_BROWSER = true;
  TRY_ANDROID = true; // Enable colour output in logcat
  STYLE = require('ansi-styles');
}
if ((typeof window.__karma__) !== 'undefined') {
  INSIDE_KARMA = true;
}

// uncomment to test; TODO pull from build environment
// Note, changing these seems to require a full build, live-reload seems to miss it?
// Prefix we normally want to leave enabled
// DISABLE_PREFIX = true;
// NOT_BROWSER = true;

const COLOURS = [
  '#0000CC', '#0000FF', '#0033CC', '#0033FF', '#0066CC', '#0066FF', '#0099CC',
  '#0099FF', '#00CC00', '#00CC33', '#00CC66', '#00CC99', '#00CCCC', '#00CCFF',
  '#3300CC', '#3300FF', '#3333CC', '#3333FF', '#3366CC', '#3366FF', '#3399CC',
  '#3399FF', '#33CC00', '#33CC33', '#33CC66', '#33CC99', '#33CCCC', '#33CCFF',
  '#6600CC', '#6600FF', '#6633CC', '#6633FF', '#66CC00', '#66CC33', '#9900CC',
  '#9900FF', '#9933CC', '#9933FF', '#99CC00', '#99CC33', '#CC0000', '#CC0033',
  '#CC0066', '#CC0099', '#CC00CC', '#CC00FF', '#CC3300', '#CC3333', '#CC3366',
  '#CC3399', '#CC33CC', '#CC33FF', '#CC6600', '#CC6633', '#CC9900', '#CC9933',
  '#CCCC00', '#CCCC33', '#FF0000', '#FF0033', '#FF0066', '#FF0099', '#FF00CC',
  '#FF00FF', '#FF3300', '#FF3333', '#FF3366', '#FF3399', '#FF33CC', '#FF33FF',
  '#FF6600', '#FF6633', '#FF9900', '#FF9933', '#FFCC00', '#FFCC33'
];

// Inspired by npm package 'debug' - see example_/debug (MIT License, browser.js)
function selectColor(namespace: string) {
  let hash = 0;
  for (let i = 0; i < namespace.length; i++) {
    // tslint:disable-next-line no-bitwise
    hash  = ((hash << 5) - hash) + namespace.charCodeAt(i);
    // tslint:disable-next-line no-bitwise
    hash |= 0; // Convert to 32bit integer
  }

  return COLOURS[Math.abs(hash) % COLOURS.length];
}

// Copied from npm package 'debug' - see example_/debug (MIT License, browser.js)
function haveColours() {
  // NB: In an Electron preload script, document will be defined but not fully
  // initialized. Since we know we're in Chrome, we'll just detect this case
  // explicitly
  if (typeof window !== 'undefined' && (<any>window).process && (<any>window).type === 'renderer') {
    return true;
  }

  // Internet Explorer and Edge do not support colors.
  if (typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.toLowerCase().match(/(edge|trident)\/(\d+)/)) {
    return false;
  }

  // is webkit? http://stackoverflow.com/a/16459606/376773
  // document is undefined in react-native: https://github.com/facebook/react-native/pull/1632
  return (typeof document !== 'undefined' && document.documentElement && document.documentElement.style && (<any>document.documentElement.style).WebkitAppearance) ||
    // is firebug? http://stackoverflow.com/a/398120/376773
    (typeof window !== 'undefined' && window.console && ((<any>window.console).firebug || (window.console.exception && window.console.table))) ||
    // is firefox >= v31?
    // https://developer.mozilla.org/en-US/docs/Tools/Web_Console#Styling_messages
    (typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/) && parseInt(RegExp.$1, 10) >= 31) ||
    // double check webkit in userAgent just in case we are in a worker
    (typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.toLowerCase().match(/applewebkit\/(\d+)/));
}

// If we have to fallback to using util.format, it wont know about %f or %O
// Expr should always be a duplicate of args[0]
// Return a modified array that can be bound to console.log, etc
function FormatReplacer(expr, ...args) {
  if (args.length < 1) { return args; }
  if (typeof expr !== 'string') return [...args];
  expr = expr.replace(/%([a-zA-Z%])/g, function(match, format) {
    if (match === '%%') return match;
    if (match === '%f') return '%d';
    if (match === '%O') return '%j';
    return match;
  });
  return [expr, ...args.splice(1)];
}

// Browser doesnt know about %j so we need to add it in
// Expr should always be a duplicate of args[0]
// Inspired by npm package 'debug' - see example_/debug (MIT License, browser.js)
// Return a modified array that can be bound to console.log, etc
function BrowserReplacer(expr, ...args) {
  let index = 0;
  if (args.length < 1) { return args; }
  if (typeof expr !== 'string') return [...args];
  expr = expr.replace(/%([a-zA-Z%])/g, function(match, format) {
    // if we encounter an escaped % then don't increase the array index
    if (match === '%%') return match;
    index++;
    if (format === 'j') {
      const val = args[index];
      match = JSON.stringify(val);
      // now we need to remove `args[index]` since it's inlined in the `format`
      args.splice(index, 1);
      index--;
    }
    return match;
  });
  return [expr, ...args.splice(1)];
}

// These are the functions that actually ends up being called as DEBUG.log(...)(), etc.
function BoundSimpleConsoleLogWrap(log): Function {
  return function(...args): Function {
    const mod = FormatReplacer(args[0], ...args);
    return console[log].bind(console, util.format(...mod));
  }
}

function BoundPrefixConsoleLogWrap(log, prefix): Function {
  const trimLen = 4008 - prefix.length - 20; // > STYLE.color.something.open + close
  return function(...args): Function {
    const mod = FormatReplacer(args[0], ...args);
    if (TRY_ANDROID) {
      // adb seems to have a width limit which will chop the colour close, approx 4000 characters
      // lets pull it back a bit anyway
      const formatted = util.format(...mod).slice(0,trimLen);
      if (log === 'error') {
        return console[log].bind(console, prefix + STYLE.color.red.open + formatted + STYLE.color.close);
      }
      if (log === 'warn') {
        return console[log].bind(console, prefix + STYLE.color.yellow.open + formatted + STYLE.color.close);
      }
      return console[log].bind(console, prefix + STYLE.color.blueBright.open + formatted + STYLE.color.close);
    }
    return console[log].bind(console, prefix + util.format(...mod));
  }
}

function SimpleBrowserNoop(log): Function {
  return function(...args): Function { return NOOP; }
}

function BoundSimpleBrowserLogWrap(log): Function {
  return function(...args): Function {
    return console[log].bind(console, ...BrowserReplacer(args[0], ...args));
  }
}

function BoundPrefixBrowserLogWrap(log, prefixArgs: Array<any>): Function {
  // These first vars need to be outside of wrapped {...}. Remember to take a deep copy too...
  const prefix = prefixArgs[0]; // possible value - ['%c[thing]%c', 'color:blah', 'color:inherit']
  const colourArgs = [...prefixArgs].splice(1);
  const wrapped = function(...args): Function {
    const mod = BrowserReplacer(args[0], ...args);
    if (mod[0] && typeof mod[0] !== 'string' && typeof mod[0] !== 'number') {
      // When first input arg is not a string, then follow the colour flags first
      // BUt let number, null, undefined also render as a string, otherwise they come through as blank
      return console[log].bind(console, ...prefixArgs, ...mod);
    } else {
      return console[log].bind(console, prefix + ' ' + mod[0], ...colourArgs, ...mod.splice(1));
    }
  }
  return wrapped;
}

const haveColour = haveColours() ? true : false;

const LEVELS = { 'TRACE': 0, 'DEBUG': 1, 'INFO': 2, 'WARN': 3, 'ERROR': 4, 'SILENT': 5};

let systemWideCurrentLevel = 1;

if (!INSIDE_KARMA) {
  console.log('[BracketsLogger Debug Logging]');
  console.log('[BracketsLogger Debug Logging] haveColour=' + haveColour); // use function to print out what the browser thinks it is
  console.log('[BracketsLogger Debug Logging] currentLevel=' + systemWideCurrentLevel); // use function to print out what the browser thinks it is
}
if (systemWideCurrentLevel > LEVELS.ERROR) {
  console.error('[BracketsLogger Debug Logging] WARNING - App Error Debugging is suppressed!');
}

const AllLoggers = {};

// Affects entire app at present, and only for future constructions.
// Therefore should be called from main.ts and somehow using a flag from the build environment.
export function setLevel(level, quiet?) {
  if (typeof level === 'string' && LEVELS[level.toUpperCase()] !== undefined) {
    level = LEVELS[level.toUpperCase()];
  }
  if (typeof level === 'number' && level >= 0 && level <= LEVELS.SILENT) {
    if (systemWideCurrentLevel !== level) {
      if (quiet !== true) console.log('[BracketsLogger Debug Logging] change: currentLevel=' + systemWideCurrentLevel + ' newLevel=' + level);
      systemWideCurrentLevel = level;
      Object.getOwnPropertyNames(AllLoggers).forEach(v => AllLoggers[v].refreshLevels());
    }
  }
}

export interface ILogging {
  Trace: Function;
  Debug: Function;
  Info: Function;
  Warn: Function;
  Error: Function;
}

export class Logging implements ILogging {
  private namespace_;
  public Trace: Function;
  public Debug: Function;
  public Info: Function;
  public Warn: Function;
  public Error: Function;

  static get(namespace: string): ILogging {
    if (Object.getOwnPropertyNames(AllLoggers).includes(namespace)) {
      return AllLoggers[namespace];
    }
    const newLogger = new Logging(namespace);
    AllLoggers[namespace] = newLogger;
    return newLogger;
  }

  constructor(namespace: string) {
    if (!INSIDE_KARMA) {
      console.log('[BracketsLogger] Enrol: ' + namespace);
    }
    this.namespace_ = namespace;
    this['Trace'] = this.enrol('trace', namespace, 0);
    this['Debug'] = this.enrol('log', namespace, 1);
    this['Info'] = this.enrol('info', namespace, 2);
    this['Warn'] = this.enrol('warn', namespace, 3);
    this['Error'] = this.enrol('error', namespace, 4);
  }

  refreshLevels() {
    // console.log('[BracketsLogger] refreshLevels: ' + this.namespace_);
    this['Trace'] = this.enrol('trace', this.namespace_, 0);
    this['Debug'] = this.enrol('log', this.namespace_, 1);
    this['Info'] = this.enrol('info', this.namespace_, 2);
    this['Warn'] = this.enrol('warn', this.namespace_, 3);
    this['Error'] = this.enrol('error', this.namespace_, 4);
  }

  private enrol(log: string, namespace: string, level): Function {
    if (systemWideCurrentLevel > level) return SimpleBrowserNoop(log);
    if (!(console[log] !== undefined)) log = 'log';
    if (INSIDE_KARMA && log === 'info') log = 'log'; // INFO not supported by karma reporter
    if (DISABLE_PREFIX) {
      if (NOT_BROWSER) {
        return BoundSimpleConsoleLogWrap(log);
      } else {
        return BoundSimpleBrowserLogWrap(log);
      }
    } else {
      namespace = namespace.replace(/%/g, '%%'); // prohibit expansion inside the log title]
      if (INSIDE_KARMA) {
        return BoundPrefixConsoleLogWrap(log, '[' + namespace + '] ');
      } else if (NOT_BROWSER) {
        if (TRY_ANDROID) {
          const colour = selectColor(namespace);
          return BoundPrefixConsoleLogWrap(log, STYLE.color.ansi16m.hex(colour) + '[' + namespace + '] ' + STYLE.color.close);
        } else {
          return BoundPrefixConsoleLogWrap(log, '[' + namespace + '] ');
        }
      } else {
        if (haveColour) {
          const colour = selectColor(namespace);
          const C1 = 'color: ' + colour;
          const C2 = 'color: inherit';
          const prefixArgs = ['%c[' + namespace + ']%c', C1, C2];
          return BoundPrefixBrowserLogWrap(log, prefixArgs);
        } else {
          return BoundPrefixBrowserLogWrap(log, ['[' + namespace + ']']);
        }
      }
    }
  }
}

/* Uncomment to test, including the custom lint rule

const f = Logging.get('Test');
// assert(f.Debug is not not-a-function)
// assert(f.Error is not not-a-function)
// assert(f.Warn is not not-a-function)
// assert(f.Info is not not-a-function)

f.Debug('Simple String')();
f.Error('Error')();
f.Warn('Warn')();
f.Debug(0)();
f.Debug(1)();
f.Debug([])();
f.Debug(false)();
f.Debug(null)();
f.Debug(null, 'more-null')();
f.Debug(undefined)();
f.Debug()();
f.Debug('Arg String with j -- %j .', {x: 123})();
f.Debug('Arg String with O -- %O .', {y: 123})();
f.Debug('Arg String with obj ...', {y: 123})();
f.Debug('What trailing semicolon?', {z: 789})()

f.Debug({hello: 'world-object-first'})();
f.Debug({hello: 'w1'}, {world: 'w1'})();

setTimeout(() => f.Debug('Timeout1.')(), 100);
setTimeout(() => f.Debug('Timeout1 Bad.'), 500);
setTimeout(() => f.Debug('Timeout2.')(), 900)
setTimeout(() => f.Debug('Timeout2 Bad.'), 1300)

function p(a, b) {}

p(() => {}, () => f.Debug('Nexted3 Bad.'));
p(() => {}, () => { p(null, null); f.Debug('Nexted4 Bad.'); });
*/

/*
debug(\(.*?\));
DEBUG$1()

console.log(\(.*?\))
DEBUG$1()

console.error(\(.*?\))
ERROR$1()
*/


// TOOD: Log.NoPrefix.Debug(blah) same as console.log
// TODO: Debug('x', y) -- if android, then make sure y gets printed. (or flag with tslint...)
// TODO: linter wont detect (e) => Log.Error(e)() mising second ()
