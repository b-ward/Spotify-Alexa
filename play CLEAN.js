const config =  require('./config.json');
const SpotifyWebApi = require('spotify-web-api-node');
var request = require('request');

let spotifyApi = new SpotifyWebApi({
    clientId : config.clientId,
    clientSecret : config.clientSecret,
    redirectUri : config.redirectUri //Redirects to this page once approved by user
});

var newAccessTokenHeaders = {
    'Authorization': `Basic ${config.base64authorization}`,
    'Content-Type': 'application/x-www-form-urlencoded'
}

var bodyDetails = {
    'refresh_token': config.refreshToken,
    'grant_type': 'refresh_token'
};

var encodedBody = [];
for (var property in bodyDetails) {
  var encodedKey = encodeURIComponent(property);
  var encodedValue = encodeURIComponent(bodyDetails[property]);
  encodedBody.push(encodedKey + "=" + encodedValue);
}
encodedBody = encodedBody.join("&");

var newAccessTokenOptions = {
    url: `https://accounts.spotify.com/api/token`,
    method: 'POST',
    headers: newAccessTokenHeaders,
    body: encodedBody
}

var selectedPlaylist = '';
var selectedDevice = '';

var offset = 0;

const urisList = [];

function getAccessToken() {
    return new Promise((resolve, reject) => {
        //Gets a new access token every time the script is run so that an expired one is not
        request(newAccessTokenOptions, (error, response) => {
            json = JSON.parse(response.body);
            spotifyApi.setAccessToken(json["access_token"]);
            var accessToken = json["access_token"];
            if(error){
                reject(error); return;
            }
            resolve(accessToken);
        })
    })
}

function setShuffle(accessToken) {
    var headers = {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
    }

    //Ensures that the playlist is not shuffled
    var shuffleOptions = {
        url: `https://api.spotify.com/v1/me/player/shuffle?state=false`,
        method: 'PUT',
        headers: headers
    }

    request(shuffleOptions);
}

function setRepeat(accessToken) {
    var headers = {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
    }

    //Ensures the playlist is on repeat
    var repeatOptions = {
        url: `https://api.spotify.com/v1/me/player/repeat?state=context`,
        method: 'PUT',
        headers: headers
    }

    request(repeatOptions);
}

function playlistsAndDevices(accessToken) {
    var headers = {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
    }

    //Used to get a maximum of 50 of the user's playlists
    var playlistOptions = {
        url: `https://api.spotify.com/v1/me/playlists?limit=50`,
        method: 'GET',
        headers: headers
    }

    return new Promise((resolve, reject) => {
        request(playlistOptions, function (error, response) {
            //Get all playlists and find the one that matches the targetPlaylist
            const json = JSON.parse(response.body)
            for(playlist of json["items"]) {
                // console.log(playlist.name)
                if (playlist.name.toLowerCase() == config.targetPlaylist.toLowerCase()) {
                    selectedPlaylist = playlist.id
                };
            }
            if(!selectedPlaylist){
                console.log('This playlist does not exist')
                return;
            }
        
            spotifyApi.getMyDevices().then((response) => {
                for(device of response.body.devices) {
                    console.log(device.name)
                    if (device.name == config.targetDevice) {
                        selectedDevice = device.id
                    };
                }
                if(!selectedDevice){
                    console.log('This device does not exist')
                    return;
                }
            }).catch((err) => {
                console.log(err);
            })
            if(error){
                reject(error); return;
            }
            resolve(selectedPlaylist, selectedDevice);
        })
    })
}

function songsInPlaylist(accessToken) {
    var headers = {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
    }

    // Configure the request
    var options = {
        url: `https://api.spotify.com/v1/playlists/${selectedPlaylist}/tracks?limit=100&offset=0`,
        method: 'GET',
        headers: headers
    }

    return new Promise((resolve, reject) => {
        //Gets the amount of songs in the playlist
        request(options, function (error, response) {
            const json = JSON.parse(response.body)
            if (json["total"] >= 100){
                offset = json["total"] - 100;
            }
            if(error){
                reject(error); return;
            }
            console.log(offset)
            resolve(offset);
        });
    });
}

function getSongsAndPlay(accessToken) {
    console.log(offset)
    var headers = {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
    }

    var newOptions = {
        url: `https://api.spotify.com/v1/playlists/${selectedPlaylist}/tracks?limit=100&offset=${offset}`,
        method: 'GET',
        headers: headers
    }

    //Gets the 100 most recently added songs to the playlist (the maximum spotify allows)
    request(newOptions, function (error, response) {
        const json = JSON.parse(response.body)
        for (const item in json["items"]){
            //This part removes any local songs that cannot be played and thus breaks the program
            var toCheck = json["items"][item]["track"]["uri"].slice(0,14);
            if (toCheck != 'spotify:local:'){
                urisList.push(json["items"][item]["track"]["uri"])
            }
        }
        const newUrisList = []
        var counter = urisList.length-1     
        while (counter > 0){
            newUrisList.push(urisList[counter])
            counter = counter - 1
        }
        spotifyApi.play({
            uris: newUrisList,
            device_id: selectedDevice
        }).catch(console.log)
    });
}

async function play() {
    var accessToken = await getAccessToken();
    setShuffle(accessToken);
    setRepeat(accessToken);
    await playlistsAndDevices(accessToken);
    await songsInPlaylist(accessToken);
    getSongsAndPlay(accessToken);
}

play();