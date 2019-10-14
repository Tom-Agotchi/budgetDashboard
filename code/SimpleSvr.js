var http = require('http');
var fs = require('fs');

const PORT=8008;
const IPaddress="192.168.11.4";
// const PORT=80;

//We can remap specific URLS if we want
var remapUrls = {};

//We use a WHITELIST for accessible files on the server
var validFiles = {};

/*
validFiles[ "/Icososphere.html" ] = { valid:true, mimeType:"text/html" }
validFiles[ "/d3.v4.min.js" ] = { valid:true, mimeType:"text/html" }
validFiles[ "/d3.geodesic.min.js" ] = { valid:true, mimeType:"text/html" }
*/

//You can do a BLACKLIST instead
var publicFileDirectory = "./public";

var allfiles = fs.readdirSync( publicFileDirectory );

for( var k in allfiles ){

	var filename = allfiles[k];

	var fullFilepath =  publicFileDirectory + '/' + filename;

	remapUrls[ '/' + filename ] = fullFilepath;

	//Add MIME type inferring from filename
	var thisMimeType = "text/html";

	if( filename.lastIndexOf( ".png" ) == filename.length - 4 ){
		thisMimeType = "image/png";
	}

	validFiles[ fullFilepath ] = { valid:true, mimeType:thisMimeType }

	console.log( filename,  thisMimeType, fullFilepath );
}


remapUrls[ "/" ] = publicFileDirectory + "/vis.html";





//Create a simple single http server
http.createServer(function(request, response) {

	var userUrl = request.url;	//There is a whole bunch of other stuff in here (like security, where it came from, etc)

	//Remap the URL if it matches first
	if( remapUrls.hasOwnProperty( userUrl ) ){
		console.log( "REMAP:" + userUrl, " => ", remapUrls[ userUrl ] );
		userUrl = remapUrls[ userUrl ];
	}

	//Is this userUrl one we allow?
	if( validFiles.hasOwnProperty( userUrl ) ){
 
		console.log( "FILE REQUEST:" + userUrl );

		//Read a file asynchronously, and return once its loaded, or error
		//fs.readFile( '.'+userUrl, function (err, fileData ) {
		fs.readFile( userUrl, function (err, fileData ) {

			if( err ){

				console.log( "File error:", err );
			}else{

				var fileProps = validFiles[ userUrl ];

				//Return the data we read from disk to the user
			    response.writeHeader( 200, { "Content-Type": fileProps.mimeType } );  
			    response.write( fileData );
			}
			response.end();  

		});
	}else{

		var parts = userUrl.split( "/" );

		var isrequest  = false;
		if( parts.length > 1 ){
			if( parts[1] == "DATA" ){
				isrequest = true;
			}
		}

		if( isrequest ){

			var usecount = 100;
			if( parts.length > 2 ){
				usecount = Number( parts[2] );
			}

			if( usecount < 1 || usecount > 10000 ){
				usecount = 100;
			}


			var numbs = [];
			for( var i = 0; i < usecount; i += 1 ){
				numbs.push( Math.random()*Math.random() );
			}

			response.writeHead(200, {"Content-Type": "application/json"});
			response.end( JSON.stringify( { count:usecount, data:numbs } ) );

		}else{

			console.log( "INVALID FILE:" + userUrl );
			response.end();
		}
	}

}).listen(PORT/*, IPaddress*/);

console.log( "listening on " + PORT );
