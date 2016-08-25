
if( process.argv.length < 2 ) {
	console.log(
		'Usage: \n' +
		'node stream-server.js <secret> [<stream-port> <websocket-port>]'
	);
	process.exit();
}

var STREAM_SECRET = "test1234",
	STREAM_PORT = process.argv[3] || 8082,
	WEBSOCKET_PORT = process.argv[4] || 8084,
	STREAM_MAGIC_BYTES = 'jsmp'; // Must be 4 bytes

var width = 320,
	height = 240;

// Websocket Server
var socketServer = new (require('ws').Server)({port: WEBSOCKET_PORT});
socketServer.on('connection', function(socket) {
	// Send magic bytes and video size to the newly connected socket
	// struct { char magic[4]; unsigned short width, height;}
	var streamHeader = new Buffer(8);
	streamHeader.write(STREAM_MAGIC_BYTES);
	streamHeader.writeUInt16BE(width, 4);
	streamHeader.writeUInt16BE(height, 6);
	socket.send(streamHeader, {binary:true});
    child = exec("avconv -s " + width + "x" + height + " -r 10 -f video4linux2 -i /dev/video0 -vf hflip -f mpeg1video -b 300k -r 30 http://127.0.0.1:8082/test1234/" + width + "/" + height + "/");
	console.log( 'New WebSocket Connection ('+socketServer.clients.length+' total)' );
	
	socket.on('close', function(code, message){
        child = exec("pkill -f avconv");
		console.log( 'Disconnected WebSocket ('+socketServer.clients.length+' total)' );
	});
});

socketServer.broadcast = function(data, opts) {
	for( var i in this.clients ) {
		if (this.clients[i].readyState == 1) {
            
			this.clients[i].send(data, opts);
		}
		else {
			console.log( 'Error: Client ('+i+') not connected.' );
		}
	}
};


// HTTP Server to accept incomming MPEG Stream
var streamServer = require('http').createServer( function(request, response) {
	var params = request.url.substr(1).split('/');

	if( params[0] == STREAM_SECRET ) {
		width = (params[1] || 320)|0;
		height = (params[2] || 240)|0;
		
		console.log(
			'Stream Connected: ' + request.socket.remoteAddress + 
			':' + request.socket.remotePort + ' size: ' + width + 'x' + height
		);
		request.on('data', function(data){
			socketServer.broadcast(data, {binary:true});
		});
	}
	else {
		console.log(
			'Failed Stream Connection: '+ request.socket.remoteAddress + 
			request.socket.remotePort + ' - wrong secret.'
		);
		response.end();
	}
}).listen(STREAM_PORT);

//http://nodejs.org/api.html#_child_processes
var sys = require('sys')
var exec = require('child_process').exec;
var child;


// create an express app
var express = require('express'),
    app = express()
    morgan = require('morgan'),
	bodyParser = require('body-parser'),
    port = process.env.PORT || 3001,
    publicDir = require('path').join(__dirname, '/public'),
    //socket server to web client
    http = require('http').Server(app),
    //io = require('socket.io')(http);

// add logging middleware
app.use(morgan('dev'));
// parsing get
app.use(bodyParser.json());
// add the express.static middleware to the app to
// serve files in the specified path
// This middleware will only call the next middleware if
// path doesn't match the static directory
app.use(express.static(publicDir));



console.log('Listening for MPEG Stream on http://127.0.0.1:'+STREAM_PORT+'/<secret>/<width>/<height>');
console.log('Awaiting WebSocket connections on ws://127.0.0.1:'+WEBSOCKET_PORT+'/');

http.listen(port);
console.log('server web server started on port %s', port);
