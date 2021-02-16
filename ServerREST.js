'use strict'

const os = require('os');
var readline = require('readline');
var net = require('net');
var fs = require('fs');
var https = require('https');
var express = require('express');
const { Console } = require('console');
var app = express();

var bcrypt = require('bcryptjs');

var privateKey = fs.readFileSync('private.pem', 'utf8');
var certificate = fs.readFileSync('file.crt', 'utf8');
var credentials = {
    key: privateKey,
    cert: certificate
};

var httpsServer = https.createServer(credentials, app);
let currentTagClient = '';
let currentAlarmClient = '';

let PIPE_PATH = '';

// If the current system is windows
if (os.type() == 'Windows_NT') {
    PIPE_PATH = "\\\\.\\pipe\\HmiRuntime";
    // if the current system is Linux
} else if (os.type() == 'Linux') {
    PIPE_PATH = '/tempcontainer/HmiRuntime';
} else {
    PIPE_PATH = '/tempcontainer/HmiRuntime';
}

app.use(express.json());

app.all('*', function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "X-Requested-With");
    res.header("Access-Control-Allow-Methods", "PUT,POST,GET,DELETE,OPTIONS");
    res.header("X-Powered-By", " 3.2.1");
    res.header("Content-Type", "application/json; charset=utf-8");
    next();
});

// Directly showing the client page
//
app.get('/*', (req, res) => {
    readFile( __dirname + "/" + "index.html", "text/html", res);
});

// Client HTML File
//
app.get('/index.html', (req, res) => {
    res.sendFile( __dirname + "/" + "index.html" );
});

// Read Tags Value
//
app.post('/tag/read', (req, res) => {

    // Requset body: {"User":"admin","User_Password":"siemens123","Tags":["HMI_Tag_1","HMI_Tag_2","HMI_Tag_3"]}
    // Place all tagnames in a new string 
    // that conforms to the syntax of the ReadTag command
    //
    var temp = req.body;

    var username = temp.User;
    var userPassword = temp.User_Password;

    if (userAuthenticationChecker(username, userPassword)) {
        var reqArray = [];
        reqArray = temp.Tags;

        var readTags = "";
        for (var i = 0; i < reqArray.length; i++) {
            readTags += '"' + reqArray[i] + '"' + ', ';
        }
        readTags = readTags.slice(0, -2);

        var clientCookie = randomCookie();

        // Connect the WinCC Unified Runtime via Openpipe
        // Send the ReadTag command
        //
        let client = net.connect(PIPE_PATH, function() {

            //Get current local time
            console.log('Read Tags:' + '\r\n' + 'Client: on connection  ' + (new Date()));

            var tagsReadCommand = '{"Message":"ReadTag","Params":{"Tags":[' + readTags + ']},"ClientCookie":"' + clientCookie + '"}\n';      
        
            Handler(res, client, clientCookie, tagsReadCommand);        
        });

        // Listen for event "error"
        // 
        client.on('error', function() {        
            console.log('The Read Tags command cannot be handled since there is no connection between REST API Server and RunTime...');
        });

        // Listen for event "end"
        //
        client.on('end', function() {   
            console.log('The connection (' + clientCookie + ') is lost. Please check whether the RunTime is running...');
        });
    } else {
        res.send("The user authentication is not matched.");
    }    
});

// Write Tags Value
//
app.post('/tag/write', (req, res) => {

    // Requset body: {"User":"admin","User_Password":"siemens123","Tags":[{"Name":"HMI_Tag_1","Value":"15"},{"Name":"HMI_Tag_2","Value":"25"},{"Name":"HMI_Tag_3","Value":"35"}]}
    // Place all tag names and values in a new string 
    // that conforms to the syntax of the WriteTag command
    // 
    var temp = req.body;

    var username = temp.User;
    var userPassword = temp.User_Password;

    if (userAuthenticationChecker(username, userPassword)) {
        var reqArray = [];
        reqArray = temp.Tags;

        var writeTagsAndValue = "";
        for (var element in reqArray){
            var tagName = reqArray[element].Name;
            var tagValue = reqArray[element].Value;
            writeTagsAndValue += '{"Name":"' + tagName + '","Value":"' + tagValue + '"},';
        }

        writeTagsAndValue = writeTagsAndValue.slice(0, -1);

        var clientCookie = randomCookie();

        // Connect the WinCC Unified Runtime via Openpipe
        // Send the WriteTag command
        // 
        let client = net.connect(PIPE_PATH, function () {

            //Get current local time
            console.log('Write Tags:' + '\r\n' +'Client: on connection  ' + (new Date()));    

            var tagWriteCommand = '{"Message":"WriteTag","Params":{"Tags":[' + writeTagsAndValue + ']},"ClientCookie":"' + clientCookie + '"}\n';    
        
            Handler(res, client, clientCookie, tagWriteCommand);
        });

        // Listen for event "error"
        // 
        client.on('error', function() {        
            console.log('The Write Tags command cannot be handled since there is no connection between REST API Server and RunTime...');
        });

        // Listen for event "end"
        //
        client.on('end', function(){   
            console.log('The connection (' + clientCookie + ') is lost. Please check whether the RunTime is running...');
        });
    } else {
        res.send("The user authentication is not matched.");
    }  
});

// Read Alarm
//
app.post('/alarm/read', (req, res) => {

    // Requset body: {"User":"admin","User_Password":"siemens123","SystemNames":"","Filter":"AlarmClassName = 'Alarm'","LanguageId":"2052"}
    // Get each element of request body
    // 
    var temp = req.body;

    var username = temp.User;
    var userPassword = temp.User_Password;

    if (userAuthenticationChecker(username, userPassword)) {
        var systemName = temp.SystemNames;
        var filter = temp.Filter;  
        var languageId = temp.LanguageId;

        // Place all elements in a new string 
        // that conforms to the syntax of the ReadAlarm command
        // 
        var systemNameCommand;
        var filterLangCommand;

        // System Names 
        // 
        if (systemName == "") {
            systemNameCommand = '';
        } else {
            if (filter == "" && languageId == "") {
                systemNameCommand = '"SystemNames":["' + systemName + '"]';
            } else {
                systemNameCommand = '"SystemNames":["' + systemName + '"], ';
            }
        }   

        // Filters & LanguageID
        //
        if (filter == "") {
            if (languageId == "") {
                filterLangCommand = '';
            } else {
                filterLangCommand = '"LanguageId":' + languageId;
            }
        } else {
            if (languageId == "") {
                filterLangCommand = '"Filter":"' + filter + '"';
            } else {
                filterLangCommand = '"Filter":"' + filter + '", "LanguageId":' + languageId;
            }   
        }

        // Get a random cookie
        var clientCookie = randomCookie();
        
        // Connect the WinCC Unified Runtime via Openpipe
        // Send the ReadAlarm command
        //
        let client = net.connect(PIPE_PATH, function () {
            //Get current local time
            //
            //var dateTime = GetCurrentTime();
            console.log('Read Alarms:' + '\r\n' + 'Client: on connection  ' + (new Date()));

            var ReadCommand = '{"Message":"ReadAlarm","Params":{' + systemNameCommand + filterLangCommand + '},"ClientCookie":"' + clientCookie + '"}\n';

            Handler(res, client, clientCookie, ReadCommand);        
        });

        // Listen for event "error"
        // 
        client.on('error', function() {        
            console.log('The Read Alarms command cannot be handled since there is no connection between REST API Server and RunTime...');
        });

        // Listen for event "end"
        //
        client.on('end', function(){   
            console.log('The connection (' + clientCookie + ') is lost. Please check whether the RunTime is running...');
        });
    } else {
        res.send("The user authentication is not matched.");
    }
});

// User management, including add users, remove users, and change users' passwords
// This option only can be done with the admin authentication
app.post('/users/management', (req, res) => {

    // Request body 
    // var userRequestString = '{"User":"admin","User_Password":"siemens123","Type":"AddUser","Username":"user_1","Password":"123456"}';
    // var userRequestString = '{"User":"admin","User_Password":"siemens123","Type":"RemoveUser","Username":"admin"}';
    // var userRequestString = '{"User":"admin","User_Password":"siemens123","Type":"ChangePassword","Username":"user_1","Password":"123456","NewPassword":"111111"}';

    var temp = req.body;
    var JsonString = JSON.parse(temp);

    var adminName = JsonString.User;
    var adminPasswd = JsonString.User_Password;

    if (adminAuthenticationChecker(adminName, adminPasswd)) {
        // Get the request type
        var requestType = JsonString.Type;

        // Add users
        if (requestType === "AddUser") {
            // Get the username & password
            var add_Username = JsonString.Username;
            var add_Password = JsonString.Password;

            // if the username is in the list
            if (add_Username in passwordJsonReader()) {
                console.log("This username has been used!!!");
            } else {
                // Get the salt
                var add_user_salt = bcrypt.genSaltSync(10);
                // Generate the hash password base on the password
                var user_Hash_Password = bcrypt.hashSync(add_Password, add_user_salt);
                // the string to be written into the passwd.txt
                var newUserJsonString = ',"' + add_Username + '":"' + user_Hash_Password + '"';
                fs.writeFileSync('./passwd.txt', newUserJsonString + '\n', {flag: 'a'});
                console.log('The new user ' + add_Username + ' has been registered successfully.'); 
            }
          // rermove users
        } else if (requestType === "RemoveUser") {
            // Get the name of the user to be removed
            var del_Username = JsonString.Username;
            if (del_Username === 'admin') {
                console.log('Deletion of admin user is not allowed.');
                return;
            } else {
                var passwdJson = passwordJsonReader();

                // Check if the user to be removed is in the list
                if (del_Username in passwdJson) {
                    // delete the user & password
                    delete passwdJson[del_Username.toString()];
                } else {
                    console.log('The user you want to remove is not in the list.');
                }

                var admin_hash_password = passwordJsonReader().admin;
                var adminJsonString = '"admin":"' + admin_hash_password + '"' + '\n';

                // Clear the original password.txt and then re-write user & password
                fs.writeFileSync('./passwd.txt', '');
                fs.writeFileSync('./passwd.txt', adminJsonString, {flag: 'a'});

                for (var item in passwdJson) {
                    if (!(item in passwordJsonReader())) {
                        var input = ',"' + item + '":"' + passwdJson[item] + '"' + '\n';
                        fs.writeFileSync('./passwd.txt', input, {flag: 'a'});
                    }
                }
            }
          // Change the user password
        } else if (requestType === "ChangePassword") {
            var passwordJson = passwordJsonReader();
            var admin_hash_password = passwordJson.admin;

            // Get the salt
            var change_user_salt = bcrypt.genSaltSync(10);
            // Generate the hash password base on the password
            var user_Hash_Password = bcrypt.hashSync(new_password, change_user_salt);

            // Modify the user password
            passwordJson[username.toString()] = user_Hash_Password;
            
            var adminJsonString = '"admin":"' + admin_hash_password + '"' + '\n';

            fs.writeFileSync('./passwd.txt', '');
            fs.writeFileSync('./passwd.txt', adminJsonString, {flag: 'a'});
            
            for (var item in passwordJson) {
                if (!(item in passwordJsonReader())) {
                    var input = ',"' + item + '":"' + passwordJson[item] + '"' + '\n';
                    fs.writeFileSync('./passwd.txt', input, {flag: 'a'});
                }
            }
        }
    } else {
        console.log("Cannot match the admin authentication!!!");
    }
});

// Listening on Port 4000
//
httpsServer.listen(4000, () => console.log('Listening on port 4000...'));

// Subscribe & Unsubscribe tags
var tagServer = net.createServer(function(socket) {

    console.log('\n' + 'connect: ' + socket.remoteAddress + ':' + socket.remotePort);
    socket.setEncoding('binary');

    var isTagUnsubscription;   
    var currentCookie = 0; 

    let client;

    socket.on('data', function(data) { 

        var JsonString = JSON.parse(data);
        
        var username = JsonString.User;
        var userPassword = JsonString.User_Password;

        // Check the user authentication by checking the user name & password
        if (userAuthenticationChecker(username, userPassword)) {
            var clientCookie = randomCookie();

            client = net.connect(PIPE_PATH, () => {
                // if the command is the tag unsubscription
                if (data.indexOf('UnsubscribeTag') != -1) {
                    isTagUnsubscription = 1;

                    var cookie = JsonString.ClientCookie;

                    var Unsubscribecommand = `{"Message":"UnsubscribeTag","ClientCookie":"` + cookie + `"}\n`;
                    currentTagClient.write(Unsubscribecommand);
                } else {
                    isTagUnsubscription = 0;

                    currentTagClient = client;

                    console.log('Subscribe Tags:' + '\r\n' + 'Client: on connection  ' + (new Date()));

                    var index = data.indexOf("Message");

                    var requestBody = (data.toString()).slice(index-1, data.length - 1);               

                    // The tag subscirption command
                    var tagsSubscribeCommand = '{' + requestBody + ',"ClientCookie":"' + clientCookie + '"}\n';
                    currentCookie = clientCookie;

                    // send the command to the Runtime
                    client.write(tagsSubscribeCommand);
                
                    console.log("====================================================================================================================");
                }

                const rl = readline.createInterface({                    
                    input: client,
                    crlfDelay: Infinity
                });

                // send the result to the client
                rl.on('line', (line) => {
                    //console.log(line);
                    if (isTagUnsubscription === 0) {
                        socket.write(line);                  
                        console.log('The new tag change has been sent to the client. With a Cookie: ' + currentCookie + '. ' +  (new Date()));
                    } else if (isTagUnsubscription === 1) {
                        socket.write(line);
                        console.log('The tag subscription(' + clientCookie + ') has been stopped. ' +  (new Date()));
                    }
                });

                socket.on('close', () => {
                    isTagUnsubscription = 1;
                    // console.log('Connection end');
                    var unSubString = '{"Message":"UnsubscribeTag","ClientCookie":"' + currentCookie + '"}\n';
                    client.write(unSubString);
            
                });
            });
        } else {
            socket.write("The user authentication is not matched.");
        }        
    });

    // listening on the error event
    socket.on('error', (err) => {
        // console.log(err);
    });

}).listen(4001);

// listening on the 'listening' event
tagServer.on('listening', function() {
    console.log("Listening on port 4001 for tags subscription..");
});

// lisening on the 'error' event
tagServer.on("error", (err) => {
    console.log(err);
});


// Subscribe & Unsubscribe alarms
var alramServer = net.createServer(function(socket) {    

    console.log('\n' + 'connect: ' + socket.remoteAddress + ':' + socket.remotePort);
    socket.setEncoding('binary');

    var isAlarmUnsubscription;
    var currentCookie = '';

    let client;

    socket.on('data', function(data) {

        var JsonString = JSON.parse(data);

        var username = JsonString.User;
        var userPassword = JsonString.User_Password;

        if (userAuthenticationChecker(username, userPassword)) {
            var clientCookie = randomCookie();

            client = net.connect(PIPE_PATH, () => {
                // if the command is the alarm unsubscription
                if (data.indexOf('UnsubscribeAlarm') != -1) {
                    isAlarmUnsubscription = 1;

                    var cookie = JsonString.ClientCookie;
    
                    // Send the unsubscription command to the Runtime
                    var UnsubscriptionCommand =  `{"Message":"UnsubscribeAlarm","ClientCookie":"` + cookie + `"}\n`;
                    currentAlarmClient.write(UnsubscriptionCommand);
    
                } else {
    
                    isAlarmUnsubscription = 0;
    
                    // Keep the current client for unsubscription
                    currentAlarmClient = client;
    
                    console.log('Subscribe Alarms:' + '\r\n' + 'Client: on connection  ' + (new Date()));

                    var index = data.indexOf("Message");

                    var requestBody = (data.toString()).slice(index-1, data.length - 1);   
    
                    // The tag subscirption command
                    var tagsSubscribeCommand = '{' + requestBody + ',"ClientCookie":"' + clientCookie + '"}\n';
    
                    // Keep the current cookie for unsubscription 
                    currentCookie = clientCookie;
    
                    // send the command to the Runtime
                    client.write(tagsSubscribeCommand);
    
                    console.log("====================================================================================================================");
                }
    
                const rl = readline.createInterface({                    
                    input: client,
                    crlfDelay: Infinity
                });
    
                rl.on('line', (line) => {
                    if (isAlarmUnsubscription === 0) {
                        socket.write(line);                   
                        console.log('The new alarm change has been sent to the client. With a Cookie: ' + currentCookie + '. ' +  (new Date()));
                    } else if (isAlarmUnsubscription === 1) {
                        socket.write(line);
                        console.log('The tag subscription(' + clientCookie + ') has been stopped. ' +  (new Date()));
                    }
                });
            });

            // Listening on the close event
            socket.on('close', () => {
                isAlarmUnsubscription = 1;
                var unSubString = '{"Message":"UnsubscribeAlarm","ClientCookie":"' + currentCookie + '"}\n';
                client.write(unSubString);
            });

        } else {
            socket.write("The user authentication is not matched.");
        }


    });

    // Listening on the close event
    // socket.on('close', () => {
    //     isAlarmUnsubscription = 1;
    //     var unSubString = '{"Message":"UnsubscribeAlarm","ClientCookie":"' + currentCookie + '"}\n';
    //     client.write(unSubString);
    // });

    // listening on the error event
    socket.on('error', (err) => {
        // console.log(err);
    });
}).listen(4002);

// listening on the 'listening' event
alramServer.on('listening', function() {
    console.log("Listening on port 4002 for alarms subscription..");
});

// listening on the 'error' event
alramServer.on('error', function(err) {
    console.log(err);
});

// Function for generating random Cookie
//
function randomCookie(length) {
    length = length || 20;
    var chars = "ABCDEFGHIJKMNOPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz0123456789";
    var maxPos = chars.length;
    var str = '';
    for (var i = 0; i < length; i++){
        str += chars.charAt(Math.floor(Math.random() * maxPos));
    }
    return str;
}

// Function for Sending requests to WinCC Unified RunTime 
// receive feedback from Unified && Convert the WinCC Unified Runtime response to JSON Format
// Send to the Cilent
// (The Funciton Name has to be redefined if the Handler is not suitable)
// 
function Handler(res, client, clientCookie, Command) {

    // Send request to WinCC Unified RunTime 
    // 
    client.write(Command);

    console.log('Already send the ReadTag command. ' + (new Date()));
    console.log("CilentCookie: " + clientCookie);

    const rl = readline.createInterface({
        input: client,
        crlfDelay: Infinity
    });

    // Listen for event "line"
    // 
    rl.on('line', (line) => {

        // Convert the WinCC Unified Runtime response to JSON Format
        // Send to the Cilent
        // 
        let obj = JSON.parse(line);        
        res.send(obj);
        
        var endDateTime = GetCurrentTime();
        console.log("The result is sent to the client  " + endDateTime + "\r\n" + 'Listening on port 4000...' + "\r\n");

        res.end();
    });
}

// Function for loading the index.html File
// 
function readFile(filePath, contentType, response) {
    response.writeHead(200, {"Content-type": contentType});

    var stream = fs.createReadStream(filePath);

    stream.on('error', () => {
        response.writeHead(500, {"content-type": contentType});
        response.end("<h1>500 Server Error</h1>");
    });

    stream.pipe(response);
}

// make the stop for a few seconds
function sleep(delay) {
    var time = delay * 1000;
    var start = (new Date()).getTime();
    while ((new Date()).getTime() - start < time) {
        continue;
    }
}

// Get the current local time
function GetCurrentTime() {
    var sentTime = new Date();
    var dateTime = sentTime.toLocaleString();
    return dateTime;
}

// A reader to read the passwd.txt file 
function passwordJsonReader() {
    var data = fs.readFileSync("./passwd.txt", 'utf-8');
    var dataJson = '{' + '\n' + '   ' + data + '\n' + '}';
    var dataJsonString = JSON.parse(dataJson);
    return dataJsonString;
}

// check the admin authentcation 
function adminAuthenticationChecker(username, Passwd) {    
    // If the username is admin
    if (username === 'admin') {
        // Check the password is match the admin password
        var isCorrect = bcrypt.compareSync(Passwd, passwordJsonReader().admin);
        //var isCorrect = bcrypt.compareSync(Passwd, admin_hash_password);

        if (isCorrect) {
            return true;
        } else {
            return false;
        }

    } else {
        return false;
    }
}

// Check the user authentication
function userAuthenticationChecker(username, Passwd) { 
    // If the user is already registered
    if (username in (passwordJsonReader())) {
        // Get the hash password
        var user_Hash_Password = (passwordJsonReader())[username.toString()];
        // Check if the password match the hash password
        var isCorrect = bcrypt.compareSync(Passwd, user_Hash_Password);

        if (isCorrect) {
            console.log('The user ' + username + ' has login ');
            return true;            
        } else {
            console.log('The password is invalid');
            return false;
        }        
    } else {
        console.log('This user has not registered yet. Please check the username or register a new user.');
        return false;
    }
}
