import * as util from 'util';

function NOOP() {}

let DISABLE_PREFIX = false;

let NOT_BROWSER = false; // FIXME - set depending on if this is a Android (or iOS?) or a browser, etc.

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
function selectColor(namespace) {
  var hash = 0, i;

  for (i in namespace) {
    hash  = ((hash << 5) - hash) + namespace.charCodeAt(i);
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
  var index = 0;
  if (args.length < 1) { return args; }
  if (typeof expr !== 'string') return [...args];
  expr = expr.replace(/%([a-zA-Z%])/g, function(match, format) {
    // if we encounter an escaped % then don't increase the array index
    if (match === '%%') return match;
    index++;
    if (format==='j') {
      var val = args[index];
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
  return function(...args): Function {
    const mod = FormatReplacer(args[0], ...args);
    return console[log].bind(console, prefix + util.format(...mod));
  }
}

function BoundSimpleBrowserLogWrap(log): Function {
  return function(...args): Function {
    return console[log].bind(console, ...BrowserReplacer(args[0], ...args));
  }
}

function BoundPrefixBrowserLogWrap(log, prefixArgs: Array<any>): Function {
  const prefix = prefixArgs[0];
  const colourArgs = prefixArgs.splice(1);
  const f = function(...args): Function {
    const mod = BrowserReplacer(args[0], ...args);
    return console[log].bind(console, prefix + mod[0], ...colourArgs, ...mod.splice(1));
  }
  return f;
}

const haveColour = haveColours() ? true : false;

const LEVELS = { 'TRACE': 0, 'DEBUG': 1, 'INFO': 2, 'WARN': 3, 'ERROR': 4, 'SILENT': 5};

let currentLevel = 1;

console.log('[Platfarm Debug Module]');
console.log('[Platfarm Debug Module] haveColour=' + haveColours()); // use function to print out what the browser thinks it is
console.log('[Platfarm Debug Module] currentLevel=' + currentLevel); // use function to print out what the browser thinks it is
if (currentLevel > LEVELS.ERROR) {
  console.error('WARNING - App Error Debugging is suppressed!');
}

// Affects entire app at present, and only for future imports.
// Therefore should be called from main.ts and somehow using a flag from the build environment.
export function setLevel(level) {
  if (typeof level === "string" && LEVELS[level.toUpperCase()] !== undefined) {
    level = LEVELS[level.toUpperCase()];
  }
  if (typeof level === "number" && level >= 0 && level <= LEVELS.SILENT) {
    currentLevel = level;
  }
}


// TODO: Consider using a class instance per thing, so we can bind the functions to it... and also control by namespace what gets filtered
export class Logging {

  static EnrolDebug(log: string, namespace?: string): Function {
    console.log('[Logging] Enroll: ' + namespace + ',' + log);

    if (!(console[log] !== undefined)) log = 'log';

    if (DISABLE_PREFIX) {
      if (NOT_BROWSER) {
        return BoundSimpleConsoleLogWrap(log);
      } else {
        return BoundSimpleBrowserLogWrap(log);
      }
    } else {
      if (NOT_BROWSER) {
        return BoundPrefixConsoleLogWrap(log, '[' + namespace + '] ');
      } else {
        if (haveColour) {
          const colour = selectColor(namespace);
          const C1 = 'color: ' + colour;
          const C2 = 'color: inherit';
          const prefixArgs = ['%c[' + namespace + ']%c ', C1, C2];
          return BoundPrefixBrowserLogWrap(log, prefixArgs);
        } else {
          return BoundPrefixBrowserLogWrap(log, ['[' + namespace + '] ']);
        }
      }
    }
  }

  static Debug(namespace?: string): any {
    if (currentLevel > LEVELS.DEBUG) return NOOP;
    return this.EnrolDebug('log', namespace);;
  }

  static Error(namespace?: string): any {
    if (currentLevel > LEVELS.ERROR) return NOOP;
    return this.EnrolDebug('error', namespace);;
  }

  static Warn(namespace?: string): any {
    if (currentLevel > LEVELS.WARN) return NOOP;
    return this.EnrolDebug('warn', namespace);;
  }

  static Info(namespace?: string): any {
    if (currentLevel > LEVELS.INFO) return NOOP;
    return this.EnrolDebug('info', namespace);;
  }
}

// const f = Logging.Debug('Test');
// assert(f is not not-a-function)
/*
f('Simple String')();
f(0)();
f([])();
f(false)();
f(null)();
f(undefined)();
f()();
f('Arg String with j -- %j .', {x:123})();
f('Arg String with O -- %O .', {y:123})();
f('Arg String with obj ...', {y:123})();
*/