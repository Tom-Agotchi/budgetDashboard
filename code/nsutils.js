
const crypto = require('crypto');
const zlib = require('zlib');
const https = require('https');
const http = require('http');
//const httpserver = require('http-server');
const fs = require('fs');
const readline = require('readline');
const url = require('url');
const querystring = require('querystring');
const EventEmitter = require('events');

//const pg = require( 'pg' );
//const pgQueryPulsed = require( 'pg-querypulsed' );


var INVALID_REQUEST = 0;
var VALID_REQUEST = 1;
var PROCESS_TIME_START = process.hrtime();
var PERFORMANCE_CLICKERS = {};

//------------------------------------------------------------------------
//
function trace( a,b,c,d,e )
{
	if( a ){
	if( b ){
	if( c ){
	if( d ){
	if( e ){ 
			  console.log( a, b, c, d, e );
	}else{ console.log( a, b, c, d ); }
	}else{ console.log( a, b, c ); }
	}else{ console.log( a, b ); }
	}else{ console.log( a ); }
	}else{ console.log( a ); }
}

function traceIf( condition, a,b,c,d,e )
{
	if( condition ){
		trace( a,b,c,d,e )
	}
}

//Given any string.object, previx at most n copies of c to the string. IE, 17,4,'0' becomes '0017'
function prefixChars( s, n, c )
{
	var rs = '' + s;
	while( rs.length < n ){
		rs = c + rs;
	}
	if( rs.length > n ){
		rs = rs.substr( 0, n );
	}
	return rs
}
/*
trace( prefixChars( '', 4, '0' ) )
trace( prefixChars( '17', 4, '0' ) )
trace( prefixChars( 17, 4, '0' ) )
trace( prefixChars( 999, 4, '0' ) )
trace( prefixChars( 9999, 4, '0' ) )
trace( prefixChars( 99999, 4, '0' ) )
*/

//Lexicographer arrays: (simple, effective, can check quickly if a character code IS a ASCII category of one of these:)
var asciiCheckArrays = {}

function asciiCheckInitialize()
{
	var validDigit = new Array(255);
	var validUppercase = new Array(255);
	var validLowercase = new Array(255);
	var validAlphanumeric = new Array(255);
	var validPrintable = new Array(255);
	var validSign = new Array(255);
	var valide = new Array(255);
	
	for( var i = 0; i < 255; i += 1 )
	{
		validDigit[ i ] = false;
		validUppercase[ i ] = false;
		validLowercase[ i ] = false;
		validAlphanumeric[ i ] = false;
		validPrintable[ i ] = false;
		validSign[ i ] = false;
		valide[ i ] = false;
	}
	for( var i = '0'.charCodeAt(0); i < '9'.charCodeAt(0)+1; i += 1 )	//NUMBERS
	{
		validDigit[ i ] = true;
		validAlphanumeric[ i ] = true;
		validPrintable[ i ] = true;
	}
	for( var i = 'A'.charCodeAt(0); i < 'Z'.charCodeAt(0)+1; i += 1 )	//UPPERCASE
	{
		validUppercase[ i ] = true;
		validAlphanumeric[ i ] = true;
		validPrintable[ i ] = true;
	}
	for( var i = 'a'.charCodeAt(0); i < 'z'.charCodeAt(0)+1; i += 1 )	//LOWERCASE
	{
		validLowercase[ i ] = true;
		validAlphanumeric[ i ] = true;
		validPrintable[ i ] = true;
	}
	for( var i = 32; i < 48; i += 1 )	//SYMBOLS part 1
	{
		validPrintable[ i ] = true;
	}
	
	validPrintable[ 64 ] = true;	//@
	
	validPrintable[ 91 ] = true;	//	[
	validPrintable[ 92 ] = true;	//	\
	
	validPrintable[ 93 ] = true;	// ]	
	validPrintable[ 94 ] = true;	//	^
	validPrintable[ 95 ] = true;	//	_
	validPrintable[ 96 ] = true;	//	`
	
	validPrintable[ 123 ] = true;	//	{
	validPrintable[ 124 ] = true;	//	|
	validPrintable[ 125 ] = true;	//	}
	validPrintable[ 126 ] = true;	//	~
	
	validSign[ '+'.charCodeAt(0) ] = true;
	validSign[ '-'.charCodeAt(0) ] = true;
	valide[ 'e'.charCodeAt(0) ] = true;
	valide[ 'E'.charCodeAt(0) ] = true;

	asciiCheckArrays['digit'] = validDigit;
	asciiCheckArrays['uppercase'] = validUppercase;
	asciiCheckArrays['lowercase'] = validLowercase;
	asciiCheckArrays['alphanumeric'] = validAlphanumeric;
	asciiCheckArrays['printable'] = validPrintable;
	asciiCheckArrays['sign'] = validSign;
	asciiCheckArrays['e'] = valide;
	
}

asciiCheckInitialize();

function asciiIsNumber( c ){ return this.n[ c ]; }
asciiIsNumber.n = asciiCheckArrays['digit'] 

function asciiIsAlphanumeric( c ){ return this.n[ c ]; }
asciiIsAlphanumeric.n = asciiCheckArrays['alphanumeric'] 

function stringIsNumber( s )
{
	var sx = "" + s;	//force into a string
	if( sx.length > 0 ){
		//return !isNaN( sx ) && !isNaN( Number( sx ) );	
		return !isNaN( s ) && !isNaN( parseFloat( s ) ) && !isNaN( Number( sx ) );	//Hack to check by checking if the PARSED version is actually a number!
	}
	return false;
	
	
	//formatting syntax tree object:
	//[ "signed", "+":true, "-":false ]
	//[	"digits"]
	//
	//	The only allowed formatting blocks ARE:
	//
	//	digits
	//	period digits
	//	digits period digits
	//	sign digits
	//	sign period digits
	//	sign digits period digits
	//	<any of the above > 
	//		e sign digits	//Selected sign
	//		e digits			//Assumed + sign
	//
	//therefore, NOT allowed numbers are:
	//	period
	//	sign
	//	e
	//	e sign
	//So there MUST BE at least 1 run of digits in this string.
	//
	
	//	ALL POSSIBLE COMBINATIONS of numeric formatting strings; Grouped by TREE:
	//
	//	period digits e sign digits
	//	period digits e digits
	//	period digits
	//
	//	sign digits e sign digits
	//	sign digits e digits
	//	sign digits
	//
	//	sign digits period digits e sign digits
	//	sign digits period digits e digits
	//	sign digits period digits
	//
	//	sign period digits
	//
	//	sign period digits e sign digits
	//	sign period digits e digits
	//
	//	digits
	
	//	digits e sign digits
	//	digits e digits
	
	//	digits period digits e sign digits
	//	digits period digits e digits
	//	digits period digits
	//
	
	//Common number formats allowed:
	// 42			digits
	// 3.5			digits period digits
	// 4.				digits period
	// .001			period digits
	// 5e2			digits e digits
	// 1.925e-3	digits period digits e sign digits
	//
	//note that a decimal with NO FOLLOWING VALUE Is actually allowed...
	
	
	
	
	/*
	//regex slower than loop?
	
	//convert string into TYPE BLOCKS
	//	Some blocks can ONLY HAVE A LENGTH of 1 ( period, sign, e )
	//	digit blocks are n length but are contiguous digits
	//
	
	var sm = s.length;
	if( sm > 0 ){
		
		var si = 0;
		
		//SIGN CHECK
		var signed = false;
		var isnegative = false;
		
		if( s.charCodeAt( si ) == '+'.charCodeAt( 0 ) ){
			signed = true;
			isnegative = false;
			si += 1;
		}else if( s.charCodeAt( si ) == '-'.charCodeAt( 0 ) ){
			signed = true;
			isnegative = true;
			si += 1;
		}
		
		//FIRST DIGITS CHECK
		var hasfirstdigits = false;
		while( si < sm ){
			if( asciiIsNumber( s.charCodeAt( si ) ) ){
				hasfirstdigits = true;
			}else{
				si += 1;
				break;
			}
			si += 1;
		}
		
		//had a optional sign and digits
		
		//DECIMAL / EXPONENT CHECK
		if( si < sm ){
			
			var hasendingdigits = false
			if( s.charCodeAt( si ) == '.'.charCodeAt( 0 ) ){
			
				si += 1;
				//now we are [sign][digits][ . ] ...
				
				while( si < sm ){
					if( asciiIsNumber( s.charCodeAt( si ) ) ){
						hasendingdigits = true;
					}else{
						si += 1;
						break;
					}
					si += 1;
				}
				
				if( hasendingdigits ){
					
					//It's a decimal number so far. Coult have an e after.
				}else{
					
					if( !hasfirstdigits ){
						
						//this is JUST A PERIOD so no. invalid.
						//[sign][ . ] ...
						return false;
					}else{
						
						//is still OK, just starting digits with a period... "4." 
					}
				}
				
				/ *
				digits
				digits.[digits][e[+-]digits]
				[digits].digits[e[+-]digits]
				digitse[+-]digits
				* /
				
			}
			
			//now we are [sign][digits][ . ][ digits] or [sign][digits]
				
			if( si < sm ){
				if( (hasfirstdigits || hasendingdigits) && s.charCodeAt( si ) == 'e'.charCodeAt( 0 ) ){
					
					//indicating an exponential number
					//now we are [sign][digits][ e ] ...
					si += 1;
					
					if( si < sm ){
						var hasexponentsign = false; 
						
						if( s.charCodeAt( si ) == '+'.charCodeAt( 0 ) ){
							hasexponentsign = true;
							si += 1;
						}else if( s.charCodeAt( si ) == '-'.charCodeAt( 0 ) ){
							hasexponentsign = true;
							si += 1;
						}
					}else{
						return false;	//Just a trailing e with no numbers IS an error
					}
					
					var hasexponentdigits = false;
					while( si < sm ){
						if( asciiIsNumber( s.charCodeAt( si ) ) ){
							hasexponentdigits = true;
						}else{
							si += 1;
							break;
						}
						si += 1;
					}
					
					if( si < sm ){
						return false;	//TRAILING CHARACTERS are not allowed in a pure number.
					}else{
						//Well at this point, we had all the possible numeric components.
					}
					
				}else{
					
					return false	//Has trailing information! we don't allow that in a number.
				}
			}
			
			return true;	//still a complete number
			
		}else{
			return true;	//had a sign and digits, nothing else
		}

	}else{
		//empty string is not a number
	}
	return false;
	*/
	return false;
}

function sqlInjectionValueStringCheck( s )
{
	//this one is easy, check for a valid value string.
	if( s != undefined ){
		
		var sv = ( "" + s ).trim();	//remove whitespace from front and back AFTER casting to a string.
		
		if( stringIsNumber( sv ) ){	//Just a plain old number is perfectly valid input
			
			return false;
		}else{
			
			//Well now it's NOT a number, and likely a formatted string of some kind.
			
			//WE sure don't want a string terminated early.
			//	So, if we have a ' in the string, it is ALREADY completely invalid.
			if( sv.indexOf( "'" ) >= 0 ){
				
				//Reason: closing ' detected in value string
				return true;	
				
			}else{
				
				//In this case, if the value is a string (which is is currently) the code SURROUNDS it with ' + value + ' 
				//this means, we have already ignored ANYTHING with a closing single quote.
				//
				
				//There are MANY OTHER WAYS to perform an injection attack. (IE, ways to escape an opened string)
				
			
				return false;//Whatever for now.
			}
			
		}
	}
	//Reason: entry was not a string we could use or understand
	return false;
}
		
//Strange shitty things:
/*

Numbers are ONLY in these formats:
digits = { 0,1,2,3,4,5,6,7,8,9 }

digits
digits.[digits][e[+-]digits]
[digits].digits[e[+-]digits]
digitse[+-]digits

But people can also:
REAL '1.23'  -- string style
1.23::REAL   -- PostgreSQL (historical) style


//the following is VALID and results in a SELECT 'foobar' (separation by newline is OK)
SELECT 'foo'
'bar';

//the following is INVALID
SELECT 'foo'      'bar';			Not valid syntax

//Special string tagging structures
$$Dianne's horse$$
$SomeTag$Dianne's horse$SomeTag$

//Escape character codes:
\b	backspace
\f	form feed
\n	newline
\r	carriage return
\t	tab
\o, \oo, \ooo (o = 0 - 7)	octal byte value
\xh, \xhh (h = 0 - 9, A - F)	hexadecimal byte value
\uxxxx, \Uxxxxxxxx (x = 0 - 9, A - F)	16 or 32-bit hexadecimal Unicode character value
		
	

//Simply, we want to check for:
//	string and command escapes
//	anything that could compromise a plain string or number or other data type input
//
//Common entry:		' ; DROP DATABASE pubs  --
//
//Truly, we know something in this case

*/

//FROM: https://oli.me.uk/2013/06/08/searching-javascript-arrays-with-a-binary-search/
/**
 * Performs a binary search on the host array. This method can either be
 * injected into Array.prototype or called with a specified scope like this:
 * binaryIndexOf.call(someArray, searchElement);
 *
 * @param {*} searchElement The item to search for within the array.
 * @return {Number} The index of the element which defaults to -1 when not found.
 */
function binaryIndexOf( A, searchElement ) {
    //'use strict';
 
    var minIndex = 0;
    var maxIndex = A.length - 1;
    var currentIndex;
    var currentElement;
 
    while (minIndex <= maxIndex) {
        currentIndex = (minIndex + maxIndex) / 2 | 0;	// | 0 floor hack
        currentElement = A[currentIndex];
 
        if (currentElement < searchElement) {
            minIndex = currentIndex + 1;
        }
        else if (currentElement > searchElement) {
            maxIndex = currentIndex - 1;
        }
        else {
            return currentIndex;
        }
    }
 
    return -1-currentIndex;	//More useful
}

//From https://en.wikipedia.org/wiki/Levenshtein_distance
function StringDistanceLevenshteinDistance( s, t )
{
	var m = s.length;
	var n = t.length;
	
	//Rather than swapping arrays, we just use an array and swap indexes into it. Unsure if this helps.
	var V = [ new Uint32Array( n+1 ), new Uint32Array( n+1 ) ];
	var V0i = 0;
	var V1i = 1;
	
	for( var i = 0; i <= n; i += 1 ){
		V[ V0i ][ i ] = i;	//v0[i] = i;
	}
	
	var r = 0;
	for( var i = 0; i <= m-1; i += 1 ){
		 // calculate v1 (current row distances) from the previous row v0

        // first element of v1 is A[i+1][0]
        //   edit distance is delete (i+1) chars from s to match empty t
        V[ V1i ][0] = i + 1	//v1[0] = i + 1

        // use formula to fill in the rest of the row
		for( var j = 0; j <= n-1; j+= 1 ){       // for j from 0 to n-1:
            // calculating costs for A[i+1][j+1]
            var deletionCost = V[ V0i ][j + 1] + 1;	//v0[j + 1] + 1;
            var insertionCost = V[ V1i ][j] + 1;	//v1[j] + 1;
			var substitutionCost = V[ V0i ][j];//v0[j];
            if( s.charCodeAt(i) == t.charCodeAt(j) ){	// if( s[i] = t[j] ){
                //substitutionCost = v0[j]
            }else{
                substitutionCost += 1;//v0[j] + 1
			}
			
            //v1[j + 1] = Math.min( Math.min( deletionCost, insertionCost ), substitutionCost );//minimum(deletionCost, insertionCost, substitutionCost)
			V[ V1i ][j + 1] = Math.min( Math.min( deletionCost, insertionCost ), substitutionCost );
		}
		
		// copy v1 (current row) to v0 (previous row) for next iteration
		r = V[ V1i ][ n ];	//v1[ n ];
		var ti = V0i;
		V0i = V1i;
		V1i = ti;
	}
    // after the last swap, the results of v1 are now in v0... but with differing lengths...
	
	V[0] = undefined;
	V[1] = undefined;
	V = [];
	
   return r;
}

//https://gist.github.com/shawndumas/1262659	shawndumas/soundex.js
function StringDistanceSoundex(s) {
     var a = s.toLowerCase().split(''),
         f = a.shift(),
         r = '',
         codes = {
             a: '', e: '', i: '', o: '', u: '',
             b: 1, f: 1, p: 1, v: 1,
             c: 2, g: 2, j: 2, k: 2, q: 2, s: 2, x: 2, z: 2,
             d: 3, t: 3,
             l: 4,
             m: 5, n: 5,
             r: 6
         };
 
     r = f +
         a
         .map(function (v, i, a) { return codes[v] })
         .filter(function (v, i, a) {
             return ((i === 0) ? v !== codes[f] : v !== a[i - 1]);
         })
         .join('');
 
    //return (r + '000').slice(0, 4).toUpperCase();
    return (r + '000').toUpperCase();
}

function isString( s )
{
	return ( typeof s === 'string' || s instanceof String )
}

function stringSplitTrim( s, delim )
{
	if( delim == undefined ){ delim = ',' }
	var R = s.split( delim );
	for( k in R ){
		R[ k ] = R[ k ].trim();
	}
	return R;
}

function forceToNumber( v )
{
	return 0 + Number( v );
}

function forceToArray( v, sep )
{
	if( Array.isArray( v ) ){
		return v;
	}else{
		if( isString( v ) ){
			if( sep == undefined ){
				return v.split( ',' )
			}else{
				return v.split( sep )
			}
		}else{
			return [ v ];
		}
	}
}


function checkRangeInclusive( v, min, max )
{
	var nvalue = forceToNumber( v );
	if( nvalue < min ){
		return false;
	}else if( nvalue > max ){
		return false;
	}
	return true;
}


//Given a string of 0..255 code values, convert it to an array that maps to empty strings or the character itself.
function stringToCharCodeMap( s, defchar )
{
	if( defchar == undefined ){
		defchar = '';	//default is empty string (change string size)
	}
	var ca = new Array( 256 );
	
	for( var i = 0; i < ca.length; i += 1 ){
		ca[ i ] = '';
	}
	
	for( var i = 0; i < s.length; i += 1 ){
		var codedex = s.charCodeAt( i ) & 255;
		ca[ codedex ] = String.fromCharCode( codedex );
	}
	
	return ca;
}

//Giben a char code map (integer range restricted 0..255) returns the map applied to that string (either uses default empty or a character specified in map)
function stringApplyCharCodeMap( s, smap )
{
	var r = '';
	for( var i = 0; i < s.length; i += 1 ){
		r += smap[ s.charCodeAt( i ) & 255 ];
	}
	return r;
}

function stringSanitize( s, charcodemap )
{
	return stringApplyCharCodeMap( s, charcodemap );
}

function formatToDefault( a )
{
	return a;
}

function formatToString( a )
{
	return '' + a;
}

function formatToNumber( a )
{
	return Number( a );
}


function getPerfTime()
{
	var ts = process.hrtime();
	return ( ts[0]*1000 ) + ts[1]/1000000;
}

function perfClick( key )
{
	if( PERFORMANCE_CLICKERS.hasOwnProperty( key ) ){
		
		var oldt = PERFORMANCE_CLICKERS[ key ];
		var newt = process.hrtime();
		PERFORMANCE_CLICKERS[ key ] = newt;
		
		var dels = newt[0] - oldt[0];
		var delnans = newt[1] - oldt[1];
		
		if( delnans< 0 ){
			delnans += 1000000000;
		}
		return dels*1000 + delnans/1000000;
	}else{
		PERFORMANCE_CLICKERS[ key ] = process.hrtime();
		return 0;
	}
}

function asyncEmit( ee, eventname, callback )
{
  setImmediate( function (){
	ee.emit( eventname );
	if( callback ){
		callback( eventname );
	}
  } );
}

function delayEmit( ee, eventname, usems )
{
	if( usems == undefined ){ usems = 1000 }
	setTimeout( function (){
		ee.emit( eventname );
	  } , usems )
	
}

function readFileSync( fn )
{
	return fs.readFileSync( fn )
}

function readFileAsync( fn, cb )
{
	return fs.readFile( fn, cb )
}

function writeFileAsync( filepath, data, cb )
{
	return fs.writeFile( filepath, data, cb )
}

function serverRespondJSON( res, job ){
	
	//res.writeHead( errcode, errmsg, {'Content-Type':'application/json'} );
	//res.setHeader('Content-Type', 'application/json');
	res.setHeader('Content-Type', 'application/json');
	res.write( JSON.stringify( job ) );
	res.end();
}

function serverRespondJSONString( res, jobs ){
	
	//res.writeHead( errcode, errmsg, {'Content-Type':'application/json'} );
	//res.setHeader('Content-Type', 'application/json');
	res.setHeader('Content-Type', 'application/json');
	res.write( jobs );
	res.end();
}

function serverRespondError( res, errcode, msg ){
	
	var errmsg = "";
	
	if( http != undefined ){
		if( http.STATUS_CODES != undefined ){
			var defaultcode = http.STATUS_CODES[ errcode ];	//https
			errmsg += defaultcode;
		}
	}
	if( msg ){
		errmsg += ' ' + msg;
	}	
	trace( "serverRespondError: ", errcode, errmsg );	
	serverRespondJSON( res, { error:errmsg } )
	//res.writeHead( errcode, errmsg, {'Content-Type':'text/html'} );
	//serverRespondError
	//res.end();
}

//CONVEINIENCE -> loads up entire heirarchy of files to build things with
function getEntireHeirarchyOf_recr( originalpath, path, filter, currdepth, maxdepth, optcallback  )
{
	var fyles = [];
	if( currdepth < maxdepth ){
		var disfunc = function( thefile ){
			var filenm = path;
			if( path.lastIndexOf( '/' ) >= path.length-1 ){
				//
			}else{
				filenm +='/';
			}
			filenm += thefile;//files[ k ];	//uhhh
			if( fs.statSync( filenm ).isDirectory() ){
				var subfiles = getEntireHeirarchyOf_recr( originalpath, filenm, filter, currdepth + 1, maxdepth, optcallback );
				for( var sf in subfiles ){
					fyles.push( subfiles[ sf ] );
				}
			}else{
				
				//passess filter function
				if( filter ){
					if( filter( filenm ) ){
						fyles.push( filenm );
						if( optcallback ){
							optcallback( filenm );
						}
					}
				}else{
					fyles.push( filenm );
					if( optcallback ){
						optcallback( filenm );
					}
				}
			}
		}
		
		if( optcallback ){
			
		}else{
			var files = fs.readdirSync( path )	//Uhm...
			for( var k in files ){
				disfunc( files[k] );
			}
		}
			
	}
	return fyles;
}

function getEntireHeirarchyOf( path, filter, maxdepth, optcallback )
{
	var usepath = path;
	return getEntireHeirarchyOf_recr( usepath, usepath, filter, 0, maxdepth, optcallback  );
}

//Returns true if a string has a suffix form the list of suffixes
function hasExt( path, exts )
{
	var lpath = path.toLowerCase();
	for( ek in exts ){
		var findit = exts[ ek ].toLowerCase();
		var idx = lpath.lastIndexOf( findit );
		if( idx >= lpath.length - findit.length ){
			return true;
		}
	}
	return false;
}

function _rescanDirectoryAsset( dirprefix, dirpath = 'public', fillstruct, fopath )
{
	
	var cuthere = 7 + fopath.indexOf( dirpath )
	fopath = fopath.substr( cuthere );
	
	var ntype = 'utf-8'		//'utf-8', 'binary'
	var hcont = 'text/html'	//	'image/png'	'image/x-icon'	
	
	//guess at mime type... lol (do better at this on server startup!)
	if( hasExt( fopath, ['.gz','.zip','.rar'] ) ){ ntype = 'binary', hcont = 'application/octet-stream' }
	if( hasExt( fopath, ['.htm','.html'] ) ){ ntype = 'utf-8', hcont = 'text/html' }
	if( hasExt( fopath, ['.txt','.csv'] ) ){ ntype = 'utf-8', hcont = 'text/html' }
	if( hasExt( fopath, ['.css'] ) ){ ntype = 'binary', hcont = 'text/css' }
	if( hasExt( fopath, ['.js'] ) ){ ntype = 'utf-8', hcont = 'text/javascript' }
	if( hasExt( fopath, ['.json'] ) ){ ntype = 'utf-8', hcont = 'application/json' }
	if( hasExt( fopath, ['.png'] ) ){ ntype = 'binary', hcont = 'image/png' }
	if( hasExt( fopath, ['.ico'] ) ){ ntype = 'binary', hcont = 'image/x-icon' }
	
	
	fillstruct[ '/' + fopath ] = { locked:false, filepath:dirprefix + dirpath + '/' + fopath, nodetype:ntype, header:{ 'Content-Type': hcont } }
	trace( "ASSET: " , '/' + fopath );
	
}

function rescanDirectoryAssets( dirprefix, dirpath = 'public', fillstruct )
{

	//Load up a ENTIRE directory as public to the HTML server
	trace( 'Loading'+dirprefix + dirpath+' directory' )
	var servethese = getEntireHeirarchyOf( dirprefix + dirpath, undefined, 8 )
	for( var k in servethese ){
		var fopath = servethese[k];
		
		_rescanDirectoryAsset( dirprefix, dirpath, fillstruct, fopath )
		/*
		var cuthere = 7 + fopath.indexOf( dirpath )
		fopath = fopath.substr( cuthere );
		
		var ntype = 'utf-8'		//'utf-8', 'binary'
		var hcont = 'text/html'	//	'image/png'	'image/x-icon'	
		
		//guess at mime type... lol (do better at this on server startup!)
		if( hasExt( fopath, ['.gz','.zip','.rar'] ) ){ ntype = 'binary', hcont = 'application/octet-stream' }
		if( hasExt( fopath, ['.htm','.html'] ) ){ ntype = 'utf-8', hcont = 'text/html' }
		if( hasExt( fopath, ['.txt','.csv'] ) ){ ntype = 'utf-8', hcont = 'text/html' }
		if( hasExt( fopath, ['.css'] ) ){ ntype = 'binary', hcont = 'text/css' }
		if( hasExt( fopath, ['.js'] ) ){ ntype = 'utf-8', hcont = 'text/javascript' }
		if( hasExt( fopath, ['.json'] ) ){ ntype = 'utf-8', hcont = 'application/json' }
		if( hasExt( fopath, ['.png'] ) ){ ntype = 'binary', hcont = 'image/png' }
		if( hasExt( fopath, ['.ico'] ) ){ ntype = 'binary', hcont = 'image/x-icon' }
		
		
		fillstruct[ '/' + fopath ] = { locked:false, filepath:dirprefix + dirpath + '/' + fopath, nodetype:ntype, header:{ 'Content-Type': hcont } }
		trace( '/' + fopath );*/
	}
	
	//Hack; bad
	fillstruct[ "/favicon.ico" ] = { locked:false, filepath:dirprefix + dirpath + '/' + 'favicon/favicon.ico', nodetype:'binary', header:{ 'Content-Type': 'image/x-icon' } }
	fillstruct[ "/favicon-16x16.png" ] = { locked:false, filepath:dirprefix + dirpath + '/' + 'favicon/favicon-16x16.png', nodetype:'binary', header:{ 'Content-Type': 'image/png' } }
	fillstruct[ "/favicon-96x96.png" ] = { locked:false, filepath:dirprefix + dirpath + '/' + 'favicon/favicon-96x96.png', nodetype:'binary', header:{ 'Content-Type': 'image/png' } }
	fillstruct[ "/favicon-32x32.png" ] = { locked:false, filepath:dirprefix + dirpath + '/' + 'favicon/favicon-32x32.png', nodetype:'binary', header:{ 'Content-Type': 'image/png' } }
	fillstruct[ "/android-icon-192x192.png" ] = { locked:false, filepath:dirprefix + dirpath + '/' + 'favicon/android-icon-192x192.png', nodetype:'binary', header:{ 'Content-Type': 'image/png' } }
}


function httpGet( options, fn )
{
	return http.get( options, fn );
}

//Create a dispatcher builder object so you can more node-like build a dispatcher with chained d3 style callbacks (.add( path, extraobj, fn( req, res, params ) ), .end() )
//dispatchers = ns.createDispatcher()
//.add( '/Pgq/Get', { extraparams:'yeah' }
//	,function ( req, res, params ){
//		
//	} 
//)
function createDispatcher()
{
	//var ignoreprops = {};	use prototype definition??
	var R = Object.create( {
		add:function( path, exparams, fn ){
			var am = {};
			for( var xk in exparams ){
				am[ xk ] = exparams[ xk ];
			}
			am[ 'callfn' ] = fn
			this[ path ] = am;
			return this;
		}
		,addDefaultHandler:function( exparams, fn ){
			var am = {};
			for( var xk in exparams ){
				am[ xk ] = exparams[ xk ];
			}
			am[ 'callfn' ] = fn
			this[ '?DefaultHandler' ] = am;
			return this;
		}
		,end:function(){
			var X = {};
			for( var k in this ){
				if( k != 'add' && k != 'end' && k != 'addDefaultHandler' ){
					X[ k ] = this[ k ]
				}
			}
			return X;
		}
	} )
	return R;
}


function serverSimpleCreate( serverOptions, functionmapping )
{
	
	var ResourceURLs = {};
	
	if( serverOptions.servePublicDirectory != undefined ){
		

		//Serve up ALL FILES in the public directory as https files and things ( interesting )
		
		//Option to remap public files wiht differing rest urls. ( will not override anything in function mapping )
		
				
		//getEntireHeirarchyOf
		//hasExt
		//rescanDirectoryAssets
		
		rescanDirectoryAssets( './', serverOptions.servePublicDirectory, ResourceURLs )

		if( serverOptions.monitorPublicDirectory <= 0 ){
			//we dont then. Fine.
		}else{
				
			//This will monitor the public directory forever, and inject changes.
			fs.watch( serverOptions.servePublicDirectory, {
				persistent: true,
				recursive: true
				}, function( event, filename ) {
					if( event == "rename" ){
						
						//replace '\' with '/' ?
						filename = filename.replace( "\\", "/" );
						
						//Does the file STILL exist?
						var abspath = serverOptions.servePublicDirectory +'/' + filename;
						
						fs.access( abspath, function( err ){
							
							if( err ){
								//file was REMOVED:
								let arkey = '/' + abspath;
								
								if( ResourceURLs.hasOwnProperty( arkey ) ){
									delete ResourceURLs[ arkey ];
								}
								//console.log( "path removed: ", filename );
								
							}else{
								_rescanDirectoryAsset( './', serverOptions.servePublicDirectory, ResourceURLs, abspath )
								//console.log( "path added: ", filename );
							}
							
						} );
					}
					
					//console.log( event );
					//if ( filename ) {
					//	console.log("filename changed: " + filename); //to stdout
					//}
					//event == "rename"
					//event == "change"
				}
			);
		}
	}
	
	var subCallback = function( req, res ){
		
		//Problem; this could lock up the dispatch for LONG URLS. Check this first!!
		if( req.url.length > 4096 ){
			//hm...
			trace( "Potential long URL incepted crash/delay/attack " + req.url.length );
		}
		
		//console.log( req.url );	//Show all paths

		var url_parts = url.parse( req.url, true );
		
		if( req.method == 'GET' ){
			
			var basicresource = ResourceURLs[ url_parts.pathname ];
			if( basicresource != undefined ){
				
				//Serve basic resource
				var loadfile = true;
				if( basicresource.locked ){
					loadfile = true;	//passessUserValidationTest( req, params );
				}
				if( loadfile ){
					trace( "RESOURCE: "+ url_parts.pathname )
					//Return a file from the client disk ( index.html )
					fs.readFile( basicresource.filepath , function(error, content) {
						if (error) {
							res.writeHead(404);
							res.end( basicresource.filepath +' not found' );
							trace( "Error reading "+basicresource.filepath );
						}else {
							res.writeHead(200, basicresource.header );//{ 'Content-Type': 'text/html' });
							res.end(content, basicresource.nodetype );//'utf-8');
						}
					});
				}else{
					trace( "Not authorized for "+basicresource.filepath );
					res.end(); 
				}
				
			}else{
					
				var params = {};
				if( typeof( url_parts.query ) == typeof( "" ) ){
					//trace( "QYs: " + url_parts.query );
					if( url_parts.query.length > 0 ){
						let tempdecode = decodeURIComponent( url_parts.query );
						console.log( tempdecode );
						params = querystring.parse( tempdecode );
					}
				}else{
					var qpams = url_parts.query;
					params = new Object();
					for( var k in qpams ){
						params[k] = qpams[k];
					}
				}
				
				//Note: Can "stripAuth" from parameters here.
				//Ergo, if you have a eauth=F3DSdgOEI3Wh5gSAIDF6giar8odS8ARjg61eAOIShr0vSA
				//parameter, this can remove it from the parameter list and determine if the user IS authenticated or not.
				//Requesting logins at this point is important.
				//if( authorizationStrip( req, params ) ){
				//
				//}else{
				//	//Redirect to authentication page for user to login...
				//	//Probably want a "session request":
				//		SessionToken/Request	URB <public user login name>
				//			returns a big random block that identifies you uniquely (public key + address and other things)
				//		SessionToken/Login	hash1( URB + BRB + <username, password> ), hash2( URB + BRB + <username, password> )
				//			returns resulting token for your IP address, else just stops
				//		
				//	The user does send that User Random Block ( URB ) and their public login name over https so it can be intercepted, and it's length and randomness is in question. ( must be >= 32 bytes or 24 characters )
				//	The server does generate a Big Random Block ( BRB ) back to the user so it can be intercepted.	( must be >= 32 bytes or 24 characters )
				//		Hash collisions are possible, so we might need to use more than 1 hash type
				//	The server knows allowed usernames + passwords; therefore it can now know the POSSIBLE valid hashes; but, that means it has to check EACH ONE. 
				//		We filter it down by the 'public user login name' => username + password combo.
				//		So this means a "public user login name" should only be associated with 1 username + password.
				//	The Client has initiated a connection with https to the server; now they just have to send their token, and if the token matches the connection information, we ASSUME they are "logged in"
				//		<= means a spoofing attack has to break HTTPS and inject
				//		<= token is always set with 'public user login name' for an easier verification step (in addition to ip filtering)
				//
				//We would rather use a known authentication system but this should work and you can attack it later ( can it work from mathematica? )
				
				//		SessionRequest/ params = 
				//			-> { token:sadfohguroiasdogjas }
				//		eauth=sadfohguroiasdogjas
				//		Note that "session request" will only allow requests from the SAME (possibly spoofed) requester;
				//		So this adds no security over SSL.
				//		
				//}
					
				
				//path to function;
				var useme = functionmapping[ url_parts.pathname ];
				if( useme != undefined ){
					//url_parts.pathname
					result = useme.callfn( req, res, params );
					
					if( result != VALID_REQUEST ){
						
						trace( 'Error in known URL', url_parts.pathname );
							
						if( !res.finished ){
							serverRespondError( res, 404, 'Method Failed' );
						
							//Other options exist.
							//res.end();
						}
						
					}
					
				}else{
					
					var useme = functionmapping[ '?DefaultHandler' ];
					if( useme != undefined ){
						
						result = useme.callfn( req, res, params );
						
						if( result != VALID_REQUEST ){
							
							serverRespondError( res, 404, 'DefaultHandler Method Failed' );
							return true;
						}
						
					}else{
					
						trace( 'Unknown URL', url_parts.pathname );
						serverRespondError( res, 404, 'Method Not Defined or found' );
						return true;
					}
				}
			}
		}else{
			
			trace( 'Denying unknown method', req.method );
			serverRespondError( res, 405, 'Method Not Allowed' );
			return true;
		}
		
		return true;
	}

	var server = null;
	if( serverOptions.key != undefined && serverOptions.cert != undefined ){
			
		server = https.createServer( serverOptions, function( req, res ){
			
			//https ONLY
			if( req.connection.encrypted ){

				return subCallback( req, res );
						
			}else{
				
				trace( 'Denying http' );
				serverRespondError( res, 403, 'HTTP is denied' );
				return true;
			}

		} );
		
	}else{
		
		server = http.createServer( subCallback );
	}

	trace( "Listening "+serverOptions.port+"...", "Server" );
	
	return server.listen( serverOptions.port );
}

//------------------------------------------------------------------------

function localEncrypt( text, optkey = '!#@$)^8dfs0jkgdfh6u5' ){
	var cipher = crypto.createCipher( 'aes-256-ctr', optkey )
	var crypted = cipher.update(text,'utf8','hex')
	crypted += cipher.final('hex');
	return crypted;
}

function localDecrypt( text, optkey = '!#@$)^8dfs0jkgdfh6u5' ){
	var decipher = crypto.createDecipher( 'aes-256-ctr', optkey )
	var dec = decipher.update(text,'hex','utf8')
	dec += decipher.final('utf8');
	return dec;
}
 
function setEnvVars( opts )
{
	for( k in opts ){		
		process.env[ k ] = opts[ k ];
	}
} 

function getEnvVars( opts )
{
	for( k in opts ){		
		opts[ k ] = process.env[ k ];
	}
	return opts;
} 

function toggleEnvVars( opts )
{
	for( k in opts ){		
		if( opts[k] ){
			//ignore it, it should already exist.
		}else{
			//delete it
			if( process.env.hasOwnProperty( k ) )
			{
				delete process.env[ k ];
			}
		}
	}	
}

//------------------------------------------------------------------------
//Postgres utilities
/*

function pgInitializeClear()
{
	toggleEnvVars( {
		'PGHOSTADDR' : false
		,'PGPORT' : false
		,'PGDATABASE' : false
		,'PGUSER' : false
		,'PGPASSWORD' : false
	} );
	/*
	PGHOST behaves the same as the host connection parameter.
	PGHOSTADDR behaves the same as the hostaddr connection parameter. This can be set instead of or in addition to PGHOST to avoid DNS lookup overhead.
	PGPORT behaves the same as the port connection parameter.
	PGDATABASE behaves the same as the dbname connection parameter.
	PGUSER behaves the same as the user connection parameter.
	PGPASSWORD behaves the same as the password connection parameter. Use of this environment variable is not recommended for security reasons, as some operating systems allow non-root users to see process environment variables via ps; instead consider using the ~/.pgpass file (see Section 31.14).
	PGPASSFILE specifies the name of the password file to use for lookups. If not set, it defaults to ~/.pgpass (see Section 31.14).
	PGSERVICE behaves the same as the service connection parameter.
	PGSERVICEFILE specifies the name of the per-user connection service file. If not set, it defaults to ~/.pg_service.conf (see Section 31.15).
	PGREALM sets the Kerberos realm to use with PostgreSQL, if it is different from the local realm. If PGREALM is set, libpq applications will attempt authentication with servers for this realm and use separate ticket files to avoid conflicts with local ticket files. This environment variable is only used if Kerberos authentication is selected by the server.
	PGOPTIONS behaves the same as the options connection parameter.
	PGAPPNAME behaves the same as the application_name connection parameter.
	PGSSLMODE behaves the same as the sslmode connection parameter.
	PGREQUIRESSL behaves the same as the requiressl connection parameter.
	PGSSLCERT behaves the same as the sslcert connection parameter.
	PGSSLKEY behaves the same as the sslkey connection parameter.
	PGSSLROOTCERT behaves the same as the sslrootcert connection parameter.
	PGSSLCRL behaves the same as the sslcrl connection parameter.
	PGREQUIREPEER behaves the same as the requirepeer connection parameter.
	PGKRBSRVNAME behaves the same as the krbsrvname connection parameter.
	PGGSSLIB behaves the same as the gsslib connection parameter.
	PGCONNECT_TIMEOUT behaves the same as the connect_timeout connection parameter.
	PGCLIENTENCODING behaves the same as the client_encoding connection parameter.
	PGDATESTYLE sets the default style of date/time representation. (Equivalent to SET datestyle TO ....)
	PGTZ sets the default time zone. (Equivalent to SET timezone TO ....)
	PGGEQO sets the default mode for the genetic query optimizer. (Equivalent to SET geqo TO ....)
	PGSYSCONFDIR sets the directory containing the pg_service.conf file and in a future version possibly other system-wide configuration files.
	PGLOCALEDIR sets the directory containing the locale files for message internationalization.
	* /
	/*
	ns.trace( ns.getEnvVars( {
		'PGHOSTADDR' : 'localhost'
		,'PGPORT' : '5439'
		,'PGDATABASE' : 'DwMeta'
		,'PGUSER' : 'read_only'
		,'PGPASSWORD' : 'VMerwog38wq49tjwae'
	} ) )
	* /
}

function pgPool( opts )
{
	return pg.Pool( opts );
}

function _pgPoolClientHandler( pool, qstring, retback )
{
	pool.connect( (err, client, done) => {
		if (err){
			trace( err )
			errcallback( err );
		}else{
			
			//Convert qstring into qob ( .text, .values, .rows, ? others rowFormat, types ?)
			var qob = {
				text:''
				,values:[]
				//rowMode : 'array'	//VERY USEFUL
			};
			
			if( qstring instanceof String ){
				qob.text = qstring;
			}else{
				qob = qstring;
			}
			
			retback( client, done, qob );
		}
	} );
}

function pgPoolQueryHandler( pool, qstring, errcallback, callmeback )
{
	_pgPoolClientHandler( pool, qstring, function( client, done, qob ){
		
		client.query( qob, function responsfn(err, result ){
			done()
			if( err ){
				trace( err )
				errcallback( err );
			}else{
				callmeback( result );
			}
		} );
	} );
}

function pgPoolCursorBegin( pool, qstring, retconf )
{
	_pgPoolClientHandler( pool, qstring, function( client, done, qob ){
		
		qob.rowMode = 'array'	//VERY USEFUL
		qob.rows = 100;	//USEFUL (limits # of rows returned?)
		
		//12 random characters?
		var sad = "";
		for( var i = 0; i < 12; i+= 1 ){
			if( Math.random() < 0.5 ){
				sad += String.fromCharCode( Math.floor( Math.random()*26 + 97 ) )	//'a' ...'z'
			}else{
				sad += String.fromCharCode( Math.floor( Math.random()*26 + 65 ) )	//'A' ...'Z'
			}
		}
		qob.name = sad;	//WHAT hm.
		
		var qsaur = client.query( pgQueryPulsed( qob, qob.values ) );	//THIS IS A PULSED QUERY object which IS a Query object as well...
		
		//uh...
		qsaur.on('row', function( row ){
			qsaur.addRow(row);
		})

		qsaur.on('error', function( e ){
			//oh no!
			qsaur.error = e;
			trace( "pgPoolCursor had error ",e )
			pgPoolCursorEnd( qsaur );
		})
		
		qsaur.on('end', function( e ){
			//?
			//qsaur.error = "Ended Pulsed Query"
			//
			qsaur._cursorQueryEndedSoftly = true;
			//console.log( "Query got end event -> therefore?" )
		});
		
		//retconf( { client:client, donefn:done, squery:qsaur, error:undefined } );
		
		retconf( { client:client, donefn:done, squery:qsaur, error:undefined } );
	} );
}

function pgPoolCursorEnd( usor )
{
	//pgCursors[ arid ].cursor
	if( usor.donefn != undefined ){
		//usor.squery.handleCommandComplete();	//uhhh
		
		var olddone = usor.donefn;
		var oldsqueery = usor.squery;
		var oldclient = usor.client;
		
		//if( oldsqueery != undefined ){
			//oldsqueery.close();	//what
		//}
		
		usor.donefn = undefined;
		usor.client = undefined;
		usor.squery = undefined;
		
		//oldclient.cancel( oldclient ,oldsqueery );
		
		//oldsqueery.end();
		
		olddone();	//UHHH should be AFTER everything is finished...
			
		
		/*
		//Closes the socket... maybe 'end' isnt right?
		oldclient.end( function(){
			
			//oldclient.cancel( oldclient, oldsqueery );
			
			//???? how to "stop" a query? close? disconnect? etc?
			//oldsqueery.emit( 'end', null )
			oldsqueery.end();
	  
			//oldsqueery.connectionLast.cancel( oldclient.processID, oldclient.secretKey );
		  
			//oldsqueery.terminate();
			
			olddone();	//UHHH should be AFTER everything is finished...
		} )
		* /
	}
}

function pgPoolCursorUpdate( usor, nrows, rowback )
{
	if( usor.squery != undefined ){
		
		//usor.squery._result.addRow(row);	//ok...		
			
		//usor.squery._canceledDueToError || 
		if( usor.error == undefined ){	//}usor.squery.state == 'idle' || usor.squery.state == 'busy' || usor.squery.state=='initialized' ){
			
			if( usor.squery != undefined ){
				if( !usor.squery._cursorQueryEndedSoftly ){
					if( usor.squery.pulseFinished ){
						usor.squery.allowPulse( true );	//What
						usor.squery.instantPulse();	//Bad practice?
					}
				}
			}
			
			//Clear out _result ??
			var retrows = usor.squery.getRows( nrows );
			//var oldrows = usor.squery._result.rows;
			//usor.squery._result.rows = [];	//HACK
			
			//var rows = oldrows;	//usor.squery.getRows();
			
			if( usor.squery._cursorQueryEndedSoftly ){
				if( retrows.length < 1 ){
					rowback( undefined )
					return false;
				}
			}
			
			rowback( retrows );
			
			return true;
			
		}else{
			trace( "pgPoolCursorUpdate had some error? ", usor.error );
			rowback( undefined )
		}
	}else{
		rowback( undefined )
	}
	return false;
}

function pgWrapDate( s )
{
	return "to_date('"+s+"', 'YYYY-MM-DDFXTHH24:MI:SS.MSZ')"
	//2000-01-01T05:00:00.000Z	Is the default formatting that INCLUDES the zulu timezone; the T is a separator in the string (like oracles)
}

function pgWrapString( s )
{
	return "'" + s + "'"
}

function pgWrapNumber( s )
{
	return "" + s	//formatting of numbers...
}

function pgWrapNone( s )
{
	return s;	
}

function pgConvertResultToRowsOutput( res, mapper )
{
	var R = [];
	for( var k in res.rows ){
		var rob = res.rows[ k ];
		var myrow = {};
		for( var rk in rob ){
			var maker = mapper[ rk ];
			if( maker != undefined ){	//}mapper.hasOwnProperty( rk ) ){
				myrow[ maker.name ] = maker.fmtfn( rob[ rk ] );
			}else{
				//IGNORE
			}
		}
		R.push( myrow );
	}
	return { rows:R };

}

*/

/*
var client = new pg.Client()
client.connect()
client.query('SELECT 1 as num', assert.calls(function (err, result) {
	assert(!err)
	assert.equal(result.rows[0].num, 1)
	assert.strictEqual(result.rowCount, 1)
	client.query('SELECT * FROM person WHERE name = $1', ['Brian'], assert.calls(function (err, result) {
		assert(!err)
		assert.equal(result.rows[0].name, 'Brian')
		client.end(done)
	}))
}))
*/

function fsLoadDSV( options, callback )
{
	//Exactly what it says...
	//if( options.lineEnding == undefined ){ options.lineending = '\n' }
	if( options.seperator == undefined ){ options.seperator = ',' }
	if( options.whitespace == undefined ){ options.whitespace = " \r\n\t" }

	if( options.headerline == undefined ){ options.headerline = 0 }
	if( options.remapcolumns == undefined ){ options.remapcolumns = function(s){ return s; } }
	
	//options.seekheaderkey = ''

	if( options.filename ){
		
		var lineReader = readline.createInterface({
			input: fs.createReadStream( options.filename )
		});

		//Search athe FIRST x BYTES of the file for a specific key to calculate the options.headerline offset...
		//if( options.seekheaderkey ){
		//	//huh
		//}
		var fdata = [];
		var findex = 0;
		var fdatatypes = [];
		lineReader.on('line', function (line) {
			
			var elements = line.split( options.seperator );
			
			if( findex == options.headerline ){
				
				for( var k in elements ){
					fdatatypes.push( {
						name:elements[ k ].trim( options.whitespace )
						,type:'string'
					} )
					fdata.push( [] );
				}
			}else if( findex > options.headerline ){
				
				//'Parsing' hm... not very efficient!
				//for( var k in elements ){
				//	elements[ k ] = elements[ k ].trim( options.whitespace )
				//}
				var maxi = fdata.length;
				
				for( var k = elements.length; k < maxi; k += 1 ){	//} in elements ){
					fdata[ k ].push( '' );
				}
				
				if( maxi > elements.length ){ maxi = elements.length; }
				
				for( var k = 0; k < maxi; k += 1 ){	//} in elements ){
					fdata[ k ].push( elements[ k ] )
				}
				
				//fdata.push( elements );
			}
			findex += 1;
		});
		
		lineReader.on('close', function () {
			
			callback( undefined, { data:fdata,  format:fdatatypes } );
		});
		
	}else{
		callback( "no .filename provided in options" );
	}
}

function datasetFindColumn( ds, matchfn )
{
	
	if( typeof matchfn == "string" ){	//}instanceof String ){
		var smatch = "" + matchfn;
		matchfn = function( s ){
			//return ns.LevenshteinDistance( smatch, s );	//Case sensetive
			return StringDistanceLevenshteinDistance( smatch.toUpperCase(), s.toUpperCase() );
		}
	}
	
	var bestscore = 99999999;
	var bestscorek = 0;
	for( var k in ds.format ){
		var score = matchfn( ds.format[ k ].name );
		if( score < bestscore ){
			bestscore = score;
			bestscorek = Number(k);
		}
	}
	return bestscorek
}

function datasetConvertToMappedColumn( ds, coldex )
{
	if( ds.format[ coldex ].mapping != undefined ){
		
	}else{
		
		//doing this kind of map ONLY WORKS on strings so. keep that in mind...
		
		var dl = ds.data[ coldex ];
		var ukk = [];
		var uk = {};
		
		var orderstrings = true;
		
		if( orderstrings ){
			
			var skoke = {};
			for( var k in dl ){
				skoke[ dl[ k] ] = 0;
			}
			var sinkeys = Object.keys( skoke );
			
			sinkeys.sort();	//NOTE: there are MANY MANY ways to SORT STRINGS. So. keep that in mind...
			
			//lexicographic sinkeys <-> means pow2 lookup.
			for( var si = 0; si < sinkeys.length; si += 1 ){
				ukk.push( sinkeys[si] );
				uk[ sinkeys[si] ] = si;
			}
		}
	
		var nd = new Uint32Array( dl.length );
		for( var k in dl ){
			var v = dl[k];	//value of this row
			var newdex = uk[ v ];	//did we already index it?
			var ki = Number( k );
			if( newdex != undefined ){
				nd[ ki ] = newdex;
			}else{
				newdex = ukk.length;
				uk[ v ] = ukk.length;
				ukk.push( v );
				nd[ ki ] = newdex;
			}
		}
		
		ds.format[ coldex ].mapping = ukk;	//Array index lookup!
		ds.data[ coldex ] = nd;	//super efficient!
	}
	return ds.format[ coldex ].mapping;
}

function datasetBuildColumnIndex( ds, coldex )
{
	//Column data MUST BE NUMERIC ( use datasetConvertToMappedColumn to force this for strings! )
	var dl = ds.data[ coldex ];
	
	//Radix searches are the FASTEST WAY TO DO THIS possible...
	//So, a hex radix search seems logical:
	//	<-> Find MAXIMUM INDEX available
	//	<- Compute hex representation length maximum
	//	<- Create tree for first digit
	// Repeat. There will ALWAYS BE LEAVES and this tree will NOT be balanced but it WILL be complete.
	//	0007 => 0 -> 0 -> 0 -> 7
	//	FEAD => F -> E -> A -> D
	//
	//However, we want to look for a: single value, and a range of values.
	//A sorted array will be faster than the above (due to js issues)
	//
	//So sort array by numerical value (Note that, optomizing string keys so they are ALSO in order is imperitive here... this will lend meaning to the strings. Really, a levenstein sorting would be awesome however impossible that is.)
	//
	
	//Collect all unique keys -> rows
	var u = {};
	var keys = [];
	var ikmax = dl.length;
	for (var ik = 0; ik < ikmax; ik += 1 ){
		var v = Number( dl[ ik ] );
		if( u.hasOwnProperty( v ) ){
			u[ v ].push( ik )
		}else{
			u[ v ] = [ ik ];
			keys.push( v );	//List of known keys
		}
	}
	
	//Sort keys in order (numeric order, strings have to be sorted in mapping but. Hm.)
	keys.sort( function compare(a, b) { return a -b; } );	//NOTE: Array.sort() does not work with Array.NUMERIC
	
	//Sort each set of rows for each unique key
	for( var uk in u ){
		u[ uk ].sort( function compare(a, b) { return a -b; } );
	}
	
	//keys is all the UNIQUE VALUES mapped to the ROWS they are contained in...
	//Now that we have a map of unique key -> sorted rows that it belongs to;
	//we must STORE this result in a meaningful way...
	//for now, we just store the whole darn thing. (can be greatly inefficient!)
	
	ds.format[ coldex ].nindex = { keys:keys, keytorows:u }
	
	return ds.format[ coldex ].nindex;
}

function datasetGetRowsMatching( ds, coldex, valcheck )
{
	var dl = ds.data[ coldex ];
	var R = [];
	
	var idex = ds.format[ coldex ].nindex;
	if( idex != undefined ){
		
		//ds.format[ coldex ].nindex = { keys:keys, keytorows:u }
	
		
		//convert valcheck <-> mapped string index ( hm )
		var map = ds.format[ coldex ].mapping;
		if( map != undefined ){
			//valcheck needs to be MAPPED so... huh.
			//interestingly enough, because mapping is NOT sorted, we can't do much here.
			//Instead, if mapping IS sorted, we can reverse it fairly well... (binary checks)
			//	ds.format[ coldex ].mapping[ ] min, ... ds.format[ coldex ].mapping[ max ]
			//	<-> hop around until it works...
			if( map.length > 0 ){
				//var sStart = map[0]
				//var sEnd = map[ map.length - 1 ]
				var mapi = binaryIndexOf( map, valcheck );
				//trace( map, mapi, valcheck )
				valcheck = mapi;
			}
		}
		
		var bindex = binaryIndexOf( idex.keys, valcheck );
		//trace( "vs: ", valcheck , bindex );
		if( bindex >= 0 ){
			var rowi = idex.keys[ bindex ];
			//trace( "YAY", bindex, rowi )
			//trace( "ris: ", idex.keytorows[ rowi ] )
			R = idex.keytorows[ rowi ]
		}else{
			trace( bindex )
		}
		
	}else{
	
		if( ds.format[ coldex ].mapping != undefined ){
			//valcheck = ds.format[ coldex ].mapping;	//???? this maps INDEX to string, not the other way around...
			//Probably want to find the... hm.
			var mapps = ds.format[ coldex ].mapping;
			for( var sk in mapps ){
				if( mapps[sk] == valcheck ){
					valcheck = sk;
				}
			}
		}
		
		//SPLIT THIS and merge later (hm) or, deal with this asynchronously...
		var rowmax = dl.length;
		for( var rowi = 0; rowi < rowmax; rowi += 1 )
		{
			if( dl[ rowi ] == valcheck )
			{
				R.push( rowi );
			}
		}
	}
	return R;
}

function datasetGetColumnNames( ds )
{
	var hdr = [];
	for( var fk in ds.format ){
		hdr.push( ds.format[fk].name )
	}
	return hdr;
}

function datasetGetRows( ds, rowis )
{
	var R = [];
	for( rk in rowis ){
		var rowi = rowis[ rk ];
		var row = []
		
		
		
		for( var fk in ds.data ){
			if( ds.format[ fk ].mapping != undefined){
				row.push( ds.format[ fk ].mapping[ ds.data[fk][ rowi ] ] );
			}else{
				row.push( ds.data[fk][ rowi ] );
			}
		}
		R.push( row );
	}
	return R;	
}

/*
//Specialized block of lines loading of a LARGE DSV ( Delimeter Separated Value ) file...
//Efficiently storing a array of FIXED TYPES is a thing we need; so...
//	"numeric" as int32's, floats, or doubles?
//	"lexical" as a dictionary of lookups (store int32's to reference them)
//"Dataset" mentality..
function datasetLoadDSV( options, endcallback, rowscallback )
{
	//Exactly what it says...
	if( options.lineEnding == undefined ){ options.lineending = '\n' }
	if( options.seperator == undefined ){ options.seperator = ',' }
	if( options.whitespace == undefined ){ options.whitespace = " \r\n\t" }

	if( options.headerline == undefined ){ options.headerline = 0 }
	if( options.remapcolumns == undefined ){ options.remapcolumns = function(s){ return s; } }
	
	//options.filename
	//options.headerline = 0
	//options.seekheaderkey = ''
	//options.remapcolumns = function( s ){ return s }

	if( options.filename ){
		
		fs.open( options.filename, 'r', function( err, fd ) {
			if( err ){
				endcallback( err );
			}else{
				
			}
		} )
		
		/*
		fs.readFile( options.filename, (err, data) => {
			if (err) throw err;
			console.log(data);
		} );
		* /
		
	}else{
		return false;
	}
}


//Return a row by index; optionally use the rowlist instead (search through n'th subset row)
function datasetLookupSubset( ds, rowindex, rowlist = undefined )
{
	
}

//Return a row by index
function datasetLookup( ds, rowindex )
{
	return datasetLookupSubset( ds, rowindex, rowlist );
}

//Return a row index by searching a column for a value (optional skips lets you find the n'th match)
function datasetFind( ds, column, matchfn, skips = 0 )
{
	
}

//Return a LIST OF ROW INDEXES into a dataset, by filtering down the original dataset per row. If you provide a rowset, filters THAT down.
function datasetFilter( ds, keepfn, rowlist = undefined )
{
	
}
*/

module.exports = {
	
	'INVALID_REQUEST':INVALID_REQUEST
	,'VALID_REQUEST':VALID_REQUEST
	,'trace':trace
	,'traceIf':traceIf
	,'prefixChars':prefixChars
	,'isString':isString
	,'stringSplitTrim':stringSplitTrim
	,'forceToNumber':forceToNumber
	,'forceToArray':forceToArray
	,'checkRangeInclusive':checkRangeInclusive
	,'stringToCharCodeMap':stringToCharCodeMap
	,'stringApplyCharCodeMap':stringApplyCharCodeMap
	,'stringSanitize':stringSanitize
	,'readFileSync':readFileSync
	,'readFileAsync':readFileAsync
	,'writeFileAsync':writeFileAsync
	,'formatToString':formatToString
	,'formatToNumber':formatToNumber
	,'formatToDefault':formatToDefault
	
		
	,'StringDistanceLevenshteinDistance':StringDistanceLevenshteinDistance
	,'StringDistanceSoundex':StringDistanceSoundex
	
	,'getEntireHeirarchyOf':getEntireHeirarchyOf
	
	//,'datasetLoadDSV':datasetLoadDSV
	
	,'fsLoadDSV':fsLoadDSV
	
	,'localEncrypt':localEncrypt
	,'localDecrypt':localDecrypt
	
	,'getPerfTime':getPerfTime
	,'asyncEmit':asyncEmit
	,'delayEmit':delayEmit
	
	,'serverRespondJSON':serverRespondJSON
	,'serverRespondJSONString':serverRespondJSONString
	,'serverRespondError':serverRespondError
	,'serverSimpleCreate':serverSimpleCreate
	
	,'httpGet':httpGet
	
	,'createDispatcher':createDispatcher
	
	,'setEnvVars':setEnvVars
	,'getEnvVars':getEnvVars
	,'toggleEnvVars':toggleEnvVars
	
	,'sqlInjectionValueStringCheck':sqlInjectionValueStringCheck
	
	/*
	,'pgInitializeClear':pgInitializeClear
	,'pgPool':pgPool
	,'pgPoolQueryHandler':pgPoolQueryHandler
	
	,'pgPoolCursorBegin':pgPoolCursorBegin
	,'pgPoolCursorEnd':pgPoolCursorEnd
	,'pgPoolCursorUpdate':pgPoolCursorUpdate

	,'pgWrapNone':pgWrapNone
	,'pgWrapDate':pgWrapDate
	,'pgWrapString':pgWrapString
	,'pgWrapNumber':pgWrapNumber
	
	,'pgConvertResultToRowsOutput':pgConvertResultToRowsOutput
	*/
	
	,'datasetFindColumn':datasetFindColumn
	,'datasetConvertToMappedColumn':datasetConvertToMappedColumn
	,'datasetBuildColumnIndex':datasetBuildColumnIndex
	,'datasetGetRowsMatching':datasetGetRowsMatching
	,'datasetGetColumnNames':datasetGetColumnNames
	,'datasetGetRows':datasetGetRows
}
