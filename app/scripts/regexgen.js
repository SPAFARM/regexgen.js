/*!
 * RegexGen.js - JavaScript Regular Expression Generator v0.1.0
 * https://github.com/amobiz/regexgen.js
 *
 *
 * Released under the MIT license
 * http://opensource.org/licenses/MIT
 *
 * Date: 2014-06-11
 *
 */
(function( factory ) {
    'use strict';
    // supports CommonJS(node.js), AMD(RequireJS) and browser global
    if ( typeof module !== 'undefined' && module.exports ) {
        module.exports = factory;
    }
    else if ( typeof define === 'function' && define.amd ) {
        define( factory );
    }
    else {
        window.regexGen = factory();
    }
})(function(){
    'use strict';

    var regexCodes = {
        captureParentheses: /(\((?!\?[:=!]))/g,

        characterClassChars: /^(?:.|\\[bdDfnrsStvwW]|\\x[A-Fa-f0-9]{2}|\\u[A-Fa-f0-9]{4}|\\c[A-Z])$/,

        ctrlChars: /^[A-Za-z]$/,

        hexAsciiCodes: /^[0-9A-Fa-f]{2}$/,

        hexUnicodes: /^[0-9A-Fa-f]{4}$/,

        //
        // Regular Expressions
        // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions
        // metaChars: /([.*+?^=!:${}()|\[\]\/\\])/g,
        //
        // How to escape regular expression in javascript?
        // http://stackoverflow.com/questions/2593637/how-to-escape-regular-expression-in-javascript
        // answerd by Gracenotes
        // metaChars: /([.?*+^$[\]\\(){}|-])/g,
        //
        // using Gracenotes version plus '\/'.
        // note that MDN's version includes: ':', '=', '!' and '-',
        // they are metacharacters only when used in (?:), (?=), (?!) and [0-9] (character classes), respectively.
        // metaChars: /([.?*+^$[\]\/\\(){}|-])/g,
        //
        // According to the book Regular Expression Cookbook
        // (added '/' for convenience when using the /regex/ literal):
        metaChars: /([$()*+.?[\\^{|\/])/g,

        // see
        // What literal characters should be escaped in a regex? (corner cases)
        // http://stackoverflow.com/questions/5484084/what-literal-characters-should-be-escaped-in-a-regex
        // How to escape square brackets inside brackets in grep
        // http://stackoverflow.com/questions/21635126/how-to-escape-square-brackets-inside-brackets-in-grep?rq=1
        metaClassChars: /([-\]\\^])/g,

        // treat any single character, meta characters, character classes, back reference, unicode character, ascii character,
        // control character and special escaped character in regular expression as a unit term.
        unitTerms: /^(?:.|\\[bBdDfnrsStvwW]|\\x[A-Fa-f0-9]{2}|\\u[A-Fa-f0-9]{4}|\\c[A-Z]|\\[$()*+.?[\/\\^{|]|\[(?:\\\]|[^\]])*?\]|\\\d{1,2})$/
    };

    var zeropad = '00000000';

    function toHex( value, digits ) {
        var ret = value.toString( 16 );
        if ( ret.length < digits ) {
            return zeropad.substring( 0, digits - ret.length ) + ret;
        }
        return ret;
    }

    function isArray( o ) {
        return ('[object Array]' === Object.prototype.toString.call( o ));
    }

    function _mixin( obj ) {
        var i, k, ext;
        for ( i = 1; i < arguments.length; ++i ) {
            ext = arguments[ i ];
            for ( k in ext ) {
                if ( ext.hasOwnProperty( k ) ) {
                    obj[ k ] = ext[ k ];
                }
            }
        }
        return obj;
    }

    ////////////////////////////////////////////////////////
    // Term
    ////////////////////////////////////////////////////////

    function Term( body, quantifiers ) {
        this._init( body, quantifiers );
    }

    Term.quote = function( value ) {
        return value.replace( regexCodes.metaChars, '\\$1' );
    };

    Term.charClasses = function( list, positive, warnings ) {
        var i, v, sets, value, hyphen, circumflex;

        hyphen = circumflex = '';
        sets = [];
        for ( i = 0; i < list.length; ++i ) {
            v = list[ i ];
            // range
            if ( isArray( v ) ) {
                if ( v.length === 2 &&
                ((typeof v[0] === 'number' && 0 <= v[0] && v[0] <= 9) || (typeof v[0] === 'string' && regexCodes.characterClassChars.test( v[0] ))) &&
                ((typeof v[1] === 'number' && 0 <= v[1] && v[1] <= 9) || (typeof v[1] === 'string' && regexCodes.characterClassChars.test( v[1] ))) ) {
                    sets.push( v[0] + '-' + v[1] );
                    continue;
                }
            }
            // bunch of characters
            else if ( typeof v === 'string' ) {
                if ( v.indexOf( '-' ) !== -1 ) {
                    hyphen = '-';
                    v = v.replace( /-/g, '' );
                }
                if ( v.indexOf( '^' ) !== -1 ) {
                    circumflex = '^';
                    v = v.replace( /\^/g, '' );
                }
                sets.push( v.replace( regexCodes.metaClassChars, '\\$1' ) );
                continue;
            }
            else if ( v instanceof Term ) {
                if ( regexCodes.characterClassChars.test( v._body ) ) {
                    sets.push( v._body );
                    continue;
                }
            }
            warnings.push( 'invalid character: ' + v );
        }
        value = sets.join( '' );

        if ( value ) {
            return (hyphen + value + circumflex);
        }

        value = hyphen + circumflex;
        if ( value.length === 1 && positive ) {
            return Term.quote( value );
        }
        return value;
    };

    // Sanitation function for adding anything safely to the expression
    Term.sanitize = function( body, quantifiers ) {
        if ( body instanceof Term ) {
            return body;
        }
        else if ( typeof body === 'string' ) {
            return new Term( Term.quote( body ), quantifiers );
        }
        else if ( typeof body === 'number' ) {
            return new Term( body.toString(), quantifiers );
        }
        else if ( body instanceof RegExp ) {
            return new RegexOverwrite( body.source );
        }
        return new Term()._warn( 'invalid regular expression: ', body );
    };

    Term.isUnitTerm = function( value ) {
        return regexCodes.unitTerms.test( value );
    };

    Term.wrap = function( body ) {
        if ( Term.isUnitTerm( body ) ) {
            return body;
        }
        return '(?:' + body + ')';
    };

    _mixin( Term.prototype, {

        ////////////////////////////////////////////////////

        _init: function( body, quantifiers ) {
            this._body = body || '';
            this._quantifiers = quantifiers || '';
            this._greedy = '';
            this._preLookaheads = '';
            this._lookaheads = '';
            this._overwrite = '';
        },

        // important: _generate and _generateBody should never modify the term object.
        //
        // implementation notes:
        //
        // termRequiresWrap tells fragile term(s) in sub-expression that if protection is required.
        // There are 2 situations:
        // 0.no: If there is only one term, then the terms need not protection at all.
        // 1.maybe: If the sub-expression is composed with more then one term,
        //   and the terms will be evaluated in order, i.e., will be concatenated directly,
        //   then the terms need not protection, unless it is the either expression.
        //
        // termRequiresWrap 是要通知元素是否需要使用 group 來保護內容。
        // 有兩種狀況:
        // 0.no: 元素沒有兄弟元素(僅有一個子元素)，則元素本身不需要特別保護。
        // 1.maybe: 有兄弟元素，且兄弟元素之間將直接接合(concatenated)，
        //   元素應視需要(目前只有 either 運算式有此需要)自我保護。
        _generate: function( context, termRequiresWrap ) {
            var i, n, body, bodyRequiresWrap;

            function lookahead( value ) {
                return typeof value === 'string' ? value : new Sequence( value )._generate( context, false );
            }

            bodyRequiresWrap = this._quantifiers ? 2 : (this._preLookaheads || this._lookaheads) ? 1 : 0;
            bodyRequiresWrap = Math.max( bodyRequiresWrap, termRequiresWrap );
            // let captures and labels have chances to evaluate.
            body = this._generateBody( context, bodyRequiresWrap );
            if ( this._warnings && this._warnings.length > 0 ) {
                for ( i = 0, n = this._warnings.length; i < n; ++i ) {
                    context.warnings.push( this._warnings[ i ] );
                }
            }
            if ( this._overwrite ) {
                body = this._overwrite._generate( context, termRequiresWrap );
            }
            else {
                body = lookahead( this._preLookaheads ) + body + (this._quantifiers ? (this._quantifiers + this._greedy) : '') + lookahead( this._lookaheads );
            }
            return body;
        },

        _generateBody: function( context, bodyRequiresWrap ) {
            return bodyRequiresWrap === 2 ? Term.wrap( this._body ) : this._body;
        },

        _warn: function( msg, values ) {
            if ( msg ) {
                if ( ! this._warnings ) {
                    this._warnings = [];
                }
                this._warnings.push( msg + (values ? JSON.stringify( values ) : '') );
            }
            return this;
        },

        ////////////////////////////////////////////////////
        // Lookahead
        ////////////////////////////////////////////////////

        contains: function() {
            var sequence = new Sequence( arguments, '(?=', ')' );
            if ( typeof this._preLookaheads === 'string' ) {
                this._preLookaheads = [ sequence ];
            }
            else {
                this._preLookaheads.push( sequence );
            }
            return this;
        },

        notContains: function() {
            var sequence = new Sequence( arguments, '(?!', ')' );
            if ( typeof this._preLookaheads === 'string' ) {
                this._preLookaheads = [ sequence ];
            }
            else {
                this._preLookaheads.push( sequence );
            }
            return this;
        },

        // Matches 'x' only if 'x' is followed by 'y'. This is called a lookahead. (x(?=y))
        followedBy: function() {
            var sequence = new Sequence( arguments, '(?=', ')' );
            if ( typeof this._lookaheads === 'string' ) {
                this._lookaheads = [ sequence ];
            }
            else {
                this._lookaheads.push( sequence );
            }
            return this;
        },

        // Matches 'x' only if 'x' is not followed by 'y'. This is called a negated lookahead. (x(?!y))
        notFollowedBy: function() {
            var sequence = new Sequence( arguments, '(?!', ')' );
            if ( typeof this._lookaheads === 'string' ) {
                this._lookaheads = [ sequence ];
            }
            else {
                this._lookaheads.push( sequence );
            }
            return this;
        },

        ////////////////////////////////////////////////////
        // Quantifiers
        ////////////////////////////////////////////////////

        any: function() {
            this._quantifiers = '*';
            return this;
        },

        // occurs one or more times (x+)
        many: function() {
            this._quantifiers = '+';
            return this;
        },

        // occurs zero or one times (x?)
        maybe: function() {
            this._quantifiers = '?';
            return this;
        },

        // occurs at least once or exactly specified times (+|{n})
        repeat: function( times ) {
            if ( typeof times === 'number' ) {
                this._quantifiers = '{' + times + '}';
            }
            else {
                this._quantifiers = '+';
            }
            return this;
        },

        // occurs at least min times and (optional) at most max times (?|*|+|{min,}|{min,max})
        multiple: function( minTimes, maxTimes ) {
            minTimes = (typeof minTimes === 'number' ? minTimes.toString() : '0');
            maxTimes = (typeof maxTimes === 'number' ? maxTimes.toString() : '');
            if ( maxTimes === '' ) {
                if ( minTimes === '0' ) {
                    this._quantifiers = '*';
                }
                else if ( minTimes === '1' ) {
                    this._quantifiers = '+';
                }
            }
            // 'maybe' is more clear for this situation
            else if ( minTimes === '0' && maxTimes === '1' ) {
                this._quantifiers = '?';
            }
            // note that {,n} is not valid.
            else {
                this._quantifiers = '{' + minTimes + ',' + maxTimes + '}';
            }
            return this;
        },

        greedy: function() {
            this._greedy = '';
            return this;
        },

        lazy: function() {
            this._greedy = '?';
            return this;
        },

        reluctant: function() {
            this._greedy = '?';
            return this;
        },

        // possessive: function() {
        //     this._greedy = '+';
        // },

        ////////////////////////////////////////////////////

        regex: function( value ) {
            if ( value instanceof RegExp ) {
                this._overwrite = new RegexOverwrite( value.source );
            }
            else if ( typeof value === 'string' ) {
                this._overwrite = new RegexOverwrite( value );
            }
            else {
                this._warn( 'regex(): specified regex is not a RegExp instance or is not a string. given: ', value );
            }
            return this;
        }

        ////////////////////////////////////////////////////
    });

    ////////////////////////////////////////////////////////
    // Sequence
    ////////////////////////////////////////////////////////

    function Sequence( sequence, prefixes, suffixes, join ) {
        this._init( Sequence.normalize( sequence ) );
        this._prefixes = prefixes || '';
        this._suffixes = suffixes || '';
        this._join = join || '';
    }

    Sequence.normalize = function( list ) {
        var i, n, term, terms;

        terms = [];
        if ( list && list.length > 0 ) {
            for ( i = 0, n = list.length; i < n; ++i ) {
                term = list[ i ];
                term = Term.sanitize( term );
                terms.push( term );
            }
        }
        return terms;
    };

    Sequence.prototype = new Term();

    _mixin( Sequence.prototype, {
        // bodyRequiresWrap 是要通知子元素是否需要使用 group 保護 body 內容主體。
        // 有三種狀況:
        // 0.no: 子元素沒有兄弟元素(僅有一個子元素)，則子元素本身不需要特別保護。
        // 1.maybe: 有兄弟元素，且兄弟元素之間將直接接合(concatenated)，子元素應視需要自我保護(目前只有 either 運算式有此需要)。
        // 2.must: 子元素具有 quantifiers，應視需要自我保護(除非是 unit term)。
        _generateBody: function( context, bodyRequiresWrap ) {
            var i, n, term, terms, body, values, termRequiresWrap;

            terms = this._body;

            // 下列兩種狀況下，子元素不需特別加以保護：
            // 1.若只有一個子元素，
            // 2.若母運算式採用 either 運算子 (|)，
            //   由於 either 的優先權極小，內部分隔的子元素不需要保護來自兄弟元素的侵擾。
            //   可以將各個子元素視為已受群組保護，而只需要保護好整個 either 母運算式不受外部侵擾即可。
            //   (見下面說明)
            termRequiresWrap = (terms.length === 1 || this._join === '|') ? 0 : 1;
            values = [];
            for ( i = 0, n = terms.length; i < n; ++i ) {
                term = terms[ i ];
                body = term._generate( context, termRequiresWrap );
                values.push( body );
            }
            body = values.join( this._join );

            if ( this._prefixes || this._suffixes ) {
                return this._prefixes + body + this._suffixes;
            }

            // 下列兩種狀況，此母運算式需要自我保護：
            // 1.若 bodyRequiresWrap === 2，表示外部要求一定要群組，目前只有當元素具有 quantifiers 時，才會符合此項。
            // 2.若 bodyRequiresWrap === 1，表示目前的運算式將與其他運算式直接接合(concatenated)，此時需要保護 either 運算式。
            // 注意，若 bodyRequiresWrap === 0，表示此母運算式已受適當的保護，不需要擔心受到外部及兄弟元素的侵擾。
            //
            // switch ( bodyRequiresWrap.toString() + termRequiresWrap.toString() ) {
            //     case '00':  // /()((a))/        => /a/
            //                 // /()((a)|(b))/    => /a|b/
            //     case '01':  // /()((a)(b))/     => /ab/
            //     case '10':  // /(o)((a))/       => /oa/
            //                 // /(o)((a)|(b))/   => /o(a|b)/
            //     case '11':  // /(o)((a)(b))/    => /oab/
            //     case '20':  // /(o)((a))?/      => /o(a)?/
            //                 // /(o)((a)|(b))?/  => /o(a|b)?/
            //     case '21':  // /(o)((a)(b))?/   => /o(ab)?/
            // }
            //
            // 注意：註解的 if 判斷式與下面的 if 判斷式等價，但比較容易了解。
            // if ( bodyRequiresWrap === 2 || (bodyRequiresWrap === 1 && terms.length !== 1 && this._join === '|') ) {
            if ( bodyRequiresWrap === 2 || (bodyRequiresWrap === 1 && ! termRequiresWrap) ) {
                return Term.wrap( body );
            }
            return body;
        }
    });

    ////////////////////////////////////////////////////////
    // Capture
    ////////////////////////////////////////////////////////

    function Capture( label, sequence ) {
        Sequence.call( this, sequence, '(', ')' );
        this._label = label;
    }

    Capture.currentLabel = function( context ) {
        return Label.normalize( context.captures.length );
    };

    Capture.register = function( context, captureLabel ) {
        context.captures.push( captureLabel );
    };

    Capture.lookup = function( context, captureLabel ) {
        var index;
        index = context.captures.indexOf( captureLabel );
        if ( index !== -1 ) {
            return '\\' + index;
        }
        return null;
    };

    Capture.prototype = new Sequence();

    _mixin( Capture.prototype, {
        _generateBody: function( context, bodyRequiresWrap ) {
            // note: don't assign this._label here, or the regex can't reuse.
            Capture.register( context, this._label === '' ? Capture.currentLabel( context ) : this._label );
            return Sequence.prototype._generateBody.call( this, context, bodyRequiresWrap );
        }
    });

    ////////////////////////////////////////////////////////
    // CaptureReference
    ////////////////////////////////////////////////////////

    function CaptureReference( label ) {
        this._init();
        this._label = Label.normalize( label );
    }

    CaptureReference.prototype = new Term();

    _mixin( CaptureReference.prototype, {
        _generateBody: function( context /*, bodyRequiresWrap */ ) {
            var backreference = Capture.lookup( context, this._label );
            if ( backreference ) {
                return backreference;
            }
            this._warn( 'sameAs(): back reference has no matching capture: ', this._label );
            return '';
        }
    });

    ////////////////////////////////////////////////////////
    // Label
    ////////////////////////////////////////////////////////

    function Label( label ) {
        this._label = label;
    }

    Label.normalize = function( label ) {
        if ( typeof label === 'string' ) {
            return label;
        }
        else if ( typeof label === 'number' ) {
            return label.toString();
        }
        else if ( label instanceof Label ) {
            return label._label;
        }
        return '__invalid_label__(' + label.toString() + ')';
    };

    ////////////////////////////////////////////////////////
    // RegexOverwrite
    ////////////////////////////////////////////////////////

    function RegexOverwrite( value ) {
        this._init( value );
    }

    RegexOverwrite.prototype = new Term();

    _mixin( RegexOverwrite.prototype, {
        _registerCaptures: function( context ) {
            var i, n, captures;

            captures = this._body.match( regexCodes.captureParentheses );
            if ( captures && captures.length > 0 ) {
                for ( i = 0, n = captures.length; i < n; ++i ) {
                    Capture.register( context, Capture.currentLabel( context ) );
                }
            }
        },
        _generateBody: function( context, bodyRequiresWrap ) {
            this._registerCaptures( context );
            return Term.prototype._generateBody.call( this, context, bodyRequiresWrap );
        }
    });

    ////////////////////////////////////////////////////////
    // Modifier
    ////////////////////////////////////////////////////////

    function Modifier( modifier ) {
        this._modifier = modifier;
    }

    ////////////////////////////////////////////////////////
    // regexGen
    ////////////////////////////////////////////////////////

    function jsonExec( text ) {
        var i, n, matches, json;

        json = {};
        matches = this.exec( text );    // jshint ignore: line
        if ( matches ) {
            for ( i = 0, n = matches.length; i < n; ++i ) {
                json[ this.captures[ i ] ] = matches[ i ];  // jshint ignore: line
            }
        }
        return json;
    }

    function regexGen() {
        var i, n, context, term, terms, pattern, modifiers, regex;

        terms = [];
        modifiers = [];
        context = {
            captures: [ '0' ],
            warnings: []
        };
        for ( i = 0, n = arguments.length; i < n; ++i ) {
            term = arguments[ i ];
            if ( term instanceof Modifier ) {
                if ( modifiers.indexOf( term._modifier ) !== -1 ) {
                    context.warnings.push( 'duplicated modifier: ' + term._modifier );
                    continue;
                }
                modifiers.push( term._modifier );
            }
            else {
                terms.push( term );
            }
        }
        pattern = new Sequence( terms )._generate( context, 0 );
        regex = new RegExp( pattern, modifiers.join( '' ) );
        regex.warnings = context.warnings;
        regex.captures = context.captures;
        regex.jsonExec = jsonExec;
        return regex;
    }

    _mixin( regexGen, {

        mixin: function( global ) {
            _mixin( global, regexGen );
        },

        ////////////////////////////////////////////////////
        /// Modifiers
        ////////////////////////////////////////////////////

        // Case-insensitivity modifier
        ignoreCase: function() {
            return new Modifier( 'i' );
        },

        // Default behaviour is with "g" modifier,
        // so we can turn this another way around
        // than other modifiers
        searchAll: function() {
            return new Modifier( 'g' );
        },

        // Multiline
        searchMultiLine: function() {
            return new Modifier( 'm' );
        },

        ////////////////////////////////////////////////////
        // Boundaries
        ////////////////////////////////////////////////////

        startOfLine: function() {
            return new Term( '^' );
        },

        endOfLine: function() {
            return new Term( '$' );
        },

        // Matches a word boundary. A word boundary matches the position
        // where a word character is not followed or preceeded by another word-character.
        // Note that a matched word boundary is not included in the match.
        // In other words, the length of a matched word boundary is zero.
        // (Not to be confused with [\b].)
        wordBoundary: function() {
            return new Term( '\\b' );
        },

        // Matches a non-word boundary.
        // This matches a position where the previous and next character
        // are of the same type: Either both must be words, or both must be non-words.
        // The beginning and end of a string are considered non-words.
        nonWordBoundary: function() {
            return new Term( '\\B' );
        },

        ////////////////////////////////////////////////////
        // Literal Characters
        ////////////////////////////////////////////////////

        // Any character sequence (abc)
        text: function( value ) {
            return Term.sanitize( value );
        },

        // Any optional character sequence, shortcut for Term.maybe ((?:abc)?)
        maybe: function( value ) {
            return Term.sanitize( value, '?' );
        },

        ////////////////////////////////////////////////////
        // Character Classes
        ////////////////////////////////////////////////////

        // Matches any single character except the newline character (.)
        anyChar: function() {
            return new Term( '.' );
        },

        // Any given character ([abc])
        // usage: anyCharOf( [ 'a', 'c' ], ['2', '6'], 'fgh', 'z' ): ([a-c2-6fghz])
        anyCharOf: function() {
            var warnings = [];
            return new Term( '[' + Term.charClasses( arguments, true, warnings ) + ']' )._warn( warnings );
        },

        // Anything but these characters ([^abc])
        // usage: anyCharBut( [ 'a', 'c' ], ['2', '6'], 'fgh', 'z' ): ([^a-c2-6fghz])
        anyCharBut: function() {
            var warnings = [];
            return new Term( '[^' + Term.charClasses( arguments, false, warnings ) + ']' )._warn( warnings );
        },

        ////////////////////////////////////////////////////
        // Character Shorthands
        ////////////////////////////////////////////////////

        // Matches the character with the code hh (two hexadecimal digits)
        ascii: function() {
            var i, n, value, values, warning;

            values = '';
            warning = [];
            n = arguments.length;
            if ( n > 0 ) {
                for ( i = 0; i < n; ++i ) {
                    value = arguments[ i ];
                    if ( typeof value === 'string' && regexCodes.hexAsciiCodes.test( value ) ) {
                        values += '\\x' + value;
                        continue;
                    }
                    else if ( typeof value === 'number' && 0 <= value && value <= 0xFF ) {
                        values += '\\x' + toHex( value, 2 );
                        continue;
                    }
                    warning.push( value.toString() );
                }
                return new Term( values )._warn( warning.length === 0 ? '' : 'ascii(): values are not valid 2 hex digitals ascii code(s): ', warning );
            }
            return new Term()._warn( 'ascii(): no values given, should provides a 2 hex digitals ascii code or any number <= 0xFF.' );
        },

        // Matches the character with the code hhhh (four hexadecimal digits).
        unicode: function() {
            var i, n, value, values, warning;

            values = '';
            warning = [];
            n = arguments.length;
            if ( n > 0 ) {
                for ( i = 0, n = arguments.length; i < n; ++i ) {
                    value = arguments[ i ];
                    if ( typeof value === 'string' && regexCodes.hexUnicodes.test( value ) ) {
                        values += '\\u' + value;
                        continue;
                    }
                    else if ( typeof value === 'number' && 0 <= value && value <= 0xFFFF ) {
                        values += '\\u' + toHex( value, 4 );
                        continue;
                    }
                    warning.push( value.toString() );
                }
                return new Term( values )._warn( warning.length === 0 ? '' : 'unicode(): values are not valid 2 hex digitals unicode code(s): ', warning );
            }
            return new Term()._warn( 'unicode(): no values given, should provides a 2 hex digitals ascii code or any number <= 0xFFFF.' );
        },

        // Matches a NULL (U+0000) character.
        // Do not follow this with another digit,
        // because \0<digits> is an octal escape sequence.
        nullChar: function() {
            return new Term( '\\0' );
        },

        // Matches a control character in a string.
        // Where X is a character ranging from A to Z.
        controlChar: function( value ) {
            if ( typeof value === 'string' && regexCodes.ctrlChars.test( value ) ) {
                return new Term( '\\c' + value );
            }
            return new Term()._warn( 'controlChar(): specified character is not a valid control character: ', value );
        },

        // Matches a backspace (U+0008).
        // You need to use square brackets if you want to match a literal backspace character.
        // (Not to be confused with \b.)
        backspace: function() {
            return new Term( '[\\b]' );
        },

        // Matches a form feed: (\f)
        formFeed: function() {
            return new Term( '\\f' );
        },

        // Matches a line feed: (\n)
        lineFeed: function() {
            return new Term( '\\n' );
        },

        // Matches a carriage return: (\r)
        carriageReturn: function() {
            return new Term( '\\r' );
        },

        //  Matches any line break, includes Unix and windows CRLF
        lineBreak: function() {
            return new Term( '(?:\\r\\n|\\r|\\n)' );
        },

        // Matches a single white space character, including space, tab, form feed, line feed: (\s)
        space: function() {
            return new Term( '\\s' );
        },

        // Matches a single character other than white space: (\S)
        nonSpace: function() {
            return new Term( '\\S' );
        },

        // Matches a tab (U+0009): (\t)
        tab: function() {
            return new Term( '\\t' );
        },

        // Matches a vertical tab (U+000B): (\v)
        vertTab: function() {
            return new Term( '\\v' );
        },

        // Matches a digit character: (\d)
        digital: function() {
            return new Term( '\\d' );
        },

        // Matches any non-digit character
        nonDigital: function() {
            return new Term( '\\D' );
        },

        hexDigital: function() {
            return new Term( '[0-9A-Fa-f]' );
        },

        // Matches any alphanumeric character including the underscore: (\w)
        word: function() {
            return new Term( '\\w' );
        },

        // Matches any alphanumeric character sequence including the underscore: (\w+)
        words: function() {
            return new Term( '\\w', '+' );
        },

        // Matches any non-word character.
        nonWord: function() {
            return new Term( '\\W' );
        },

        // Matches any characters except the newline character: (.*)
        anything: function() {
            return new Term( '.', '*' );
        },

        ////////////////////////////////////////////////////
        // Grouping and back references
        ////////////////////////////////////////////////////

        // Adds alternative expressions
        either: function() {
            return new Sequence( arguments, '', '', '|' )._warn(
                arguments.length >= 2 ? '' : 'eidther(): this function needs at least 2 sub-expressions. given only: ', arguments[ 0 ]
            );
        },

        // Matches specified terms but does not remember the match. The generated parentheses are called non-capturing parentheses.
        group: function() {
            //return new Sequence( arguments, '(?:', ')' );
            return new Sequence( arguments );
        },

        // Matches specified terms and remembers the match. The generated parentheses are called capturing parentheses.
        // label 是用來供 back reference 索引 capture 的編號。
        // 計算方式是由左至右，計算左括號出現的順序，也就是先深後廣搜尋。
        // capture( label('cap1'), capture( label('cap2'), 'xxx' ), capture( label('cap3'), '...' ), 'something else' )
        capture: function() {
            var label, sequence;
            if ( arguments.length > 0 && arguments[0] instanceof Label ) {
                label = arguments[0]._label;
                sequence = Array.prototype.slice.call( arguments, 1 );
            }
            else {
                label = '';
                sequence = arguments;
            }
            return new Capture( label, sequence );
        },

        // label is a reference to a capture group, and is allowed only in the capture() method
        label: function( label ) {
            return new Label( label );
        },

        // back reference
        sameAs: function( label ) {
            return new CaptureReference( label );
        },

        ////////////////////////////////////////////////////

        // trust me, just put the value as is.
        regex: function( value ) {
            if ( value instanceof RegExp ) {
                return new RegexOverwrite( value.source );
            }
            else if ( typeof value === 'string' ) {
                return new RegexOverwrite( value );
            }
            return new Term( value )._warn( 'regex(): specified regex is not a RegExp instance or is not a string: ', value );
        }

        ////////////////////////////////////////////////////
    });

    return regexGen;
});
