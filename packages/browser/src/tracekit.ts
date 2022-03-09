/**
 * 这是最初从https://github.com/occ/TraceKit 分支出来的，但后来进行了很大的修改。
 * 大幅修改，现在作为BM JS SDK的一部分被维护。
 */

/* eslint-disable @typescript-eslint/no-unsafe-member-access, max-lines */

/**
 * An object representing a single stack frame.
 * {Object} StackFrame
 * {string} url The JavaScript or HTML file URL.
 * {string} func The function name, or empty for anonymous functions (if guessing did not work).
 * {string[]?} args The arguments passed to the function, if known.
 * {number=} line The line number, if known.
 * {number=} column The column number, if known.
 * {string[]} context An array of source code lines; the middle element corresponds to the correct line#.
 */
export interface StackFrame {
  url: string;
  func: string;
  args: string[];
  line: number | null;
  column: number | null;
}

/**
 * An object representing a JavaScript stack trace.
 * {Object} StackTrace
 * {string} name The name of the thrown exception.
 * {string} message The exception error message.
 * {TraceKit.StackFrame[]} stack An array of stack frames.
 */
export interface StackTrace {
  name: string;
  message: string;
  mechanism?: string;
  stack: StackFrame[];
  failed?: boolean;
}

// global reference to slice
const UNKNOWN_FUNCTION = '?';

// Chromium based browsers: Chrome, Brave, new Opera, new Edge
const chrome = /^\s*at (?:(.*?) ?\()?((?:file|https?|blob|chrome-extension|address|native|eval|webpack|<anonymous>|[-a-z]+:|.*bundle|\/).*?)(?::(\d+))?(?::(\d+))?\)?\s*$/i;
// gecko regex: `(?:bundle|\d+\.js)`: `bundle` is for react native, `\d+\.js` also but specifically for ram bundles because it
// generates filenames without a prefix like `file://` the filenames in the stacktrace are just 42.js
// We need this specific case for now because we want no other regex to match.
const gecko = /^\s*(.*?)(?:\((.*?)\))?(?:^|@)?((?:file|https?|blob|chrome|webpack|resource|moz-extension|capacitor).*?:\/.*?|\[native code\]|[^@]*(?:bundle|\d+\.js)|\/[\w\-. /=]+)(?::(\d+))?(?::(\d+))?\s*$/i;
const winjs = /^\s*at (?:((?:\[object object\])?.+) )?\(?((?:file|ms-appx|https?|webpack|blob):.*?):(\d+)(?::(\d+))?\)?\s*$/i;
const geckoEval = /(\S+) line (\d+)(?: > eval line \d+)* > eval/i;
const chromeEval = /\((\S*)(?::(\d+))(?::(\d+))\)/;
// Based on our own mapping pattern - https://github.com/getsentry/sentry/blob/9f08305e09866c8bd6d0c24f5b0aabdd7dd6c59c/src/sentry/lang/javascript/errormapping.py#L83-L108
const reactMinifiedRegexp = /Minified React error #\d+;/i;

/** JSDoc */
// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-module-boundary-types
export function computeStackTrace(ex: any): StackTrace {
  let stack = null;
  let popSize = 0;

  if (ex) {
    if (typeof ex.framesToPop === 'number') {
      popSize = ex.framesToPop;
    } else if (reactMinifiedRegexp.test(ex.message)) {
      popSize = 1;
    }
  }

  try {
    // 必须先试着这样做，因为Opera 10 *会破坏*它的堆栈跟踪属性。
    // 它的堆栈跟踪属性，如果你试图访问堆栈
    // 栈属性的时候，Opera 10就会破坏*//它的stacktrace属性！!
    stack = computeStackTraceFromStacktraceProp(ex);
    if (stack) {
      return popFrames(stack, popSize);
    }
  } catch (e) {
    // no-empty
  }

  try {
    stack = computeStackTraceFromStackProp(ex);
    if (stack) {
      return popFrames(stack, popSize);
    }
  } catch (e) {
    // no-empty
  }

  return {
    message: extractMessage(ex),
    name: ex && ex.name,
    stack: [],
    failed: true,
  };
}

/** JSDoc */
// eslint-disable-next-line @typescript-eslint/no-explicit-any, complexity
function computeStackTraceFromStackProp(ex: any): StackTrace | null {
  if (!ex || !ex.stack) {
    return null;
  }

  const stack = [];
  const lines = ex.stack.split('\n');
  let isEval;
  let submatch;
  let parts;
  let element;

  for (let i = 0; i < lines.length; ++i) {
    if ((parts = chrome.exec(lines[i]))) {
      const isNative = parts[2] && parts[2].indexOf('native') === 0; // start of line
      isEval = parts[2] && parts[2].indexOf('eval') === 0; // start of line
      if (isEval && (submatch = chromeEval.exec(parts[2]))) {
        // throw out eval line/column and use top-most line/column number
        parts[2] = submatch[1]; // url
        parts[3] = submatch[2]; // line
        parts[4] = submatch[3]; // column
      }

      // Arpad。使用上面的regexp是非常痛苦的。它是一个相当大的黑客，但只是剥离了`地址在`//前缀，似乎是目前最快的解决方案。
      // 这里的前缀似乎是目前最快的解决方案。
      let url = parts[2] && parts[2].indexOf('address at ') === 0 ? parts[2].substr('address at '.length) : parts[2];
      // Kamil: 再多一个黑客也不会伤害到我们吧？现在理解并在这些表达式的基础上添加更多的规则
      // 会太耗费时间了。(TODO: 重写整个正则表达式以使其更易读)
      let func = parts[1] || UNKNOWN_FUNCTION;
      [func, url] = extractSafariExtensionDetails(func, url);

      element = {
        url,
        func,
        args: isNative ? [parts[2]] : [],
        line: parts[3] ? +parts[3] : null,
        column: parts[4] ? +parts[4] : null,
      };
    } else if ((parts = winjs.exec(lines[i]))) {
      element = {
        url: parts[2],
        func: parts[1] || UNKNOWN_FUNCTION,
        args: [],
        line: +parts[3],
        column: parts[4] ? +parts[4] : null,
      };
    } else if ((parts = gecko.exec(lines[i]))) {
      isEval = parts[3] && parts[3].indexOf(' > eval') > -1;
      if (isEval && (submatch = geckoEval.exec(parts[3]))) {
        // throw out eval line/column and use top-most line number
        parts[1] = parts[1] || `eval`;
        parts[3] = submatch[1];
        parts[4] = submatch[2];
        parts[5] = ''; // no column when eval
      } else if (i === 0 && !parts[5] && ex.columnNumber !== void 0) {
        // FireFox在其顶层框架中使用了这个很棒的columnNumber属性
        // 还需要注意的是，Firefox的列数是以0为基础的，而其他的东西都希望以1为基础。
        // 所以添加1
        // 注意：如果最上面的框架是评估的，这个黑客就不起作用。
        stack[0].column = (ex.columnNumber as number) + 1;
      }

      let url = parts[3];
      let func = parts[1] || UNKNOWN_FUNCTION;
      [func, url] = extractSafariExtensionDetails(func, url);

      element = {
        url,
        func,
        args: parts[2] ? parts[2].split(',') : [],
        line: parts[4] ? +parts[4] : null,
        column: parts[5] ? +parts[5] : null,
      };
    } else {
      continue;
    }

    if (!element.func && element.line) {
      element.func = UNKNOWN_FUNCTION;
    }

    stack.push(element);
  }

  if (!stack.length) {
    return null;
  }

  return {
    message: extractMessage(ex),
    name: ex.name,
    stack,
  };
}

/** JSDoc */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function computeStackTraceFromStacktraceProp(ex: any): StackTrace | null {
  if (!ex || !ex.stacktrace) {
    return null;
  }
  // 在做任何事情之前访问并存储堆栈跟踪属性。
  // 因为Opera在其他情况下并不善于提供它
  // 在其他情况下可靠地提供。
  const stacktrace = ex.stacktrace;
  const opera10Regex = / line (\d+).*script (?:in )?(\S+)(?:: in function (\S+))?$/i;
  const opera11Regex = / line (\d+), column (\d+)\s*(?:in (?:<anonymous function: ([^>]+)>|([^)]+))\((.*)\))? in (.*):\s*$/i;
  const lines = stacktrace.split('\n');
  const stack = [];
  let parts;

  for (let line = 0; line < lines.length; line += 2) {
    let element = null;
    if ((parts = opera10Regex.exec(lines[line]))) {
      element = {
        url: parts[2],
        func: parts[3],
        args: [],
        line: +parts[1],
        column: null,
      };
    } else if ((parts = opera11Regex.exec(lines[line]))) {
      element = {
        url: parts[6],
        func: parts[3] || parts[4],
        args: parts[5] ? parts[5].split(',') : [],
        line: +parts[1],
        column: +parts[2],
      };
    }

    if (element) {
      if (!element.func && element.line) {
        element.func = UNKNOWN_FUNCTION;
      }
      stack.push(element);
    }
  }

  if (!stack.length) {
    return null;
  }

  return {
    message: extractMessage(ex),
    name: ex.name,
    stack,
  };
}

/**
 * Safari网络扩展，从未知版本开始，可以产生 "纯框架 "的堆栈跟踪。
 * 它的意思是，取代了像这样的格式。
 *
 * Error: wat
 *在function@url:row:col
 *在function@url:row:col
 *在function@url:row:col
 *
 *它产生了类似的东西。
 *
 * function@url:row:col
 * function@url:row:col
 * function@url:row:col
 *
 * 因为这样，它不会被`chrome`正则所捕获，而会落入`Gecko`分支。
 * 这个函数被提取出来，所以我们可以在两个地方都使用它，而不重复逻辑。
 * 不幸的是，现在 "仅仅 "改变正则表达式太复杂了，要让它通过所有测试
 * 并修复这种情况似乎是不可能的，或者至少是太耗时的任务。
 */
const extractSafariExtensionDetails = (func: string, url: string): [string, string] => {
  const isSafariExtension = func.indexOf('safari-extension') !== -1;
  const isSafariWebExtension = func.indexOf('safari-web-extension') !== -1;

  return isSafariExtension || isSafariWebExtension
    ? [
      func.indexOf('@') !== -1 ? func.split('@')[0] : UNKNOWN_FUNCTION,
      isSafariExtension ? `safari-extension:${url}` : `safari-web-extension:${url}`,
    ]
    : [func, url];
};

/** Remove N number of frames from the stack */
function popFrames(stacktrace: StackTrace, popSize: number): StackTrace {
  try {
    return {
      ...stacktrace,
      stack: stacktrace.stack.slice(popSize),
    };
  } catch (e) {
    return stacktrace;
  }
}

/**
 * 有些情况下，stacktrace.message是一个事件对象
 * https://github.com/getsentry/sentry-javascript/issues/1949
 * 在这种特殊情况下，我们试图提取stacktrace.message.error.message
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractMessage(ex: any): string {
  const message = ex && ex.message;
  if (!message) {
    return 'No error message';
  }
  if (message.error && typeof message.error.message === 'string') {
    return message.error.message;
  }
  return message;
}
