var bcrypt = require('bcryptjs');
var fs = require('fs');

var currentUser = "admin";
var currentUserPasswd = "siemens123";
var auth = 'adminUser';

//var userRequestString = '{"Type":"AddUser","Username":"zuobiao2","Password":"123456"}';
//var userRequestString = '{"Type":"RemoveUser","Username":"zuobiao3"}';
//var userRequestString = '{"Type":"ChangePassword","Username":"zuobiao","Password":"1231231","NewPassword":"123123"}';
var userRequestString = '{"Type":"ChangeUserAuthentication","Username":"zuobiao","Password":"123123","OldAuthentication":"normalUser","NewAuthentication":"adminUser"}';

if (adminAuthenticationChecker(currentUser, currentUserPasswd)) {
    var JsonString = JSON.parse(userRequestString);
    var requestType = JsonString.Type; 

    if (requestType === 'AddUser') {
        var addUserName = JsonString.Username.toString();

        if (addUserName in passwordJsonReader()) {
            console.log("This username has been used!!!");
        } else {
            var addUserPassword = JsonString.Password.toString();
            var userAuthentication = 'normalUser';

            if (addUserName === 'admin') {
                userAuthentication = 'adminUser';
            } else {
                userAuthentication = 'normalUser';
            }

            var add_user_salt = bcrypt.genSaltSync(10);
            var user_Hash_Password = bcrypt.hashSync(addUserPassword, add_user_salt);
            var newUserJsonString = ',"' + addUserName + '":{"Password":"' + user_Hash_Password + '","Authentication":"' + userAuthentication + '"}}';

            var infoContent = fs.readFileSync('pass.txt').toString();
            var infoContent_Sub = infoContent.slice(0, infoContent.length - 1);

            fs.writeFileSync('./pass.txt', '');
            fs.writeFileSync('./pass.txt', infoContent_Sub + '\n', {flag: 'a'});
            fs.writeFileSync('./pass.txt', newUserJsonString, {flag: 'a'});
        }

    } else if (requestType === 'RemoveUser') {
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
                var admin_hash_password = passwordJsonReader().admin.Password;
                var adminJsonString = '{"admin":{"Password":"' + admin_hash_password.toString() + '","Authentication":"adminUser"}}';

                fs.writeFileSync('./pass.txt', '');
                fs.writeFileSync('./pass.txt', adminJsonString, {flag: 'a'});

                for (var item in passwdJson) {
                    if (!(item in passwordJsonReader())) {
                        var infoContent = fs.readFileSync('pass.txt').toString();
                        var infoContent_Sub = infoContent.slice(0, infoContent.length - 1);

                        fs.writeFileSync('./pass.txt', '');
                        fs.writeFileSync('./pass.txt', infoContent_Sub + '\n', {flag: 'a'});

                        var input = ',"' + item.toString() + '":{"Password":"' + passwdJson[item].Password.toString() + '","Authentication":"' + passwdJson[item].Authentication.toString() + '"}}';
                        fs.writeFileSync('./pass.txt', input, {flag: 'a'});
                    }
                }
            } else {
                console.log('The user you want to remove is not in the list.');
            }
        }

    } else if (requestType === 'ChangePassword') {
        var username  = JsonString.Username;

        if (username === 'admin') {
            console.log("It's not allowed to change the password of admin user !!!");
        } else {
            var password = JsonString.Password;
            var new_password = JsonString.NewPassword;

            if (password === new_password) {
                console.log('The new password is same as the old one.');
            } else {
                if (userAuthenticationChecker(username, password)) {
                    var passwordJson = passwordJsonReader();
                    var admin_hash_password = passwordJson.admin.Password;

                    // Get the salt
                    var change_user_salt = bcrypt.genSaltSync(10);
                    // Generate the hash password base on the password
                    var user_Hash_Password = bcrypt.hashSync(new_password, change_user_salt);

                    // Modify the user password
                    passwordJson[username.toString()].Password = user_Hash_Password.toString();

                    var adminJsonString = '{"admin":{"Password":"' + admin_hash_password.toString() + '","Authentication":"adminUser"}}';

                    fs.writeFileSync('./pass.txt', '');
                    fs.writeFileSync('./pass.txt', adminJsonString, {flag: 'a'});

                    for (var item in passwordJson) {
                        if (!(item in passwordJsonReader())) {
                            var infoContent = fs.readFileSync('pass.txt').toString();
                            var infoContent_Sub = infoContent.slice(0, infoContent.length - 1);

                            fs.writeFileSync('./pass.txt', '');
                            fs.writeFileSync('./pass.txt', infoContent_Sub + '\n', {flag: 'a'});

                            var input = ',"' + item.toString() + '":{"Password":"' + passwordJson[item].Password.toString() + '","Authentication":"' + passwordJson[item].Authentication.toString() + '"}}';
                            fs.writeFileSync('./pass.txt', input, {flag: 'a'});
                        }
                    }
                } else {
                    console.log('The user authenticaiton is not matched, please check that.');
                }
            }            
        } 
    } else if (requestType === 'ChangeUserAuthentication') {
        var username  = JsonString.Username;

        if (username === 'admin') {
            console.log("It's not allowed to change the authentication of the admin user.");
        } else {
            var password = JsonString.Password;
            if (userAuthenticationChecker(username, password)) {                
                var passwordJson = passwordJsonReader();
                var admin_hash_password = passwordJson.admin.Password;
                var old_Authentication = passwordJson[username.toString()].Authentication;
                var new_Auhtentication = JsonString.NewAuthentication;                
                if (old_Authentication === new_Auhtentication) {
                    console.log('The new authentication of ' + username +' is same as the old one.');
                } else {
                    passwordJson[username.toString()].Authentication = new_Auhtentication;

                    var adminJsonString = '{"admin":{"Password":"' + admin_hash_password.toString() + '","Authentication":"adminUser"}}';

                    fs.writeFileSync('./pass.txt', '');
                    fs.writeFileSync('./pass.txt', adminJsonString, {flag: 'a'});

                    for (var item in passwordJson) {
                        if (!(item in passwordJsonReader())) {
                            var infoContent = fs.readFileSync('pass.txt').toString();
                            var infoContent_Sub = infoContent.slice(0, infoContent.length - 1);

                            fs.writeFileSync('./pass.txt', '');
                            fs.writeFileSync('./pass.txt', infoContent_Sub + '\n', {flag: 'a'});

                            var input = ',"' + item.toString() + '":{"Password":"' + passwordJson[item].Password.toString() + '","Authentication":"' + passwordJson[item].Authentication.toString() + '"}}';
                            fs.writeFileSync('./pass.txt', input, {flag: 'a'});
                        }
                    }
                }
            } else {
                console.log('The user authenticaiton is not matched, please check that.');
            }
        }
    }

} else {
    console.log('Only the admin user can do this !!!');
}

function passwordJsonReader() {
    var infoJson = fs.readFileSync('./pass.txt');
    var infoJsonString = JSON.parse(infoJson);
    return infoJsonString;
}

// check the admin authentcation 
function adminAuthenticationChecker(username, Passwd) {    
    // If the username is admin
    // if (username === 'admin' || authentication === 'adminUser') {
    if (username === 'admin') {
        // Check the password is match the admin password
        var isCorrect = bcrypt.compareSync(Passwd, passwordJsonReader().admin.Password);
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
        var user_Hash_Password = (passwordJsonReader())[username.toString()].Password;
        // Check if the password match the hash password
        var isCorrect = bcrypt.compareSync(Passwd, user_Hash_Password);

        if (isCorrect) {
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
