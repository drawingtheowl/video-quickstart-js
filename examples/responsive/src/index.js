'use strict';

var Video = require('twilio-video');

//Import helpers-media
var helpers = require('./helpers-device');
var getDeviceSelectionOptions = helpers.getDeviceSelectionOptions;
var publishVideoTrack = helpers.publishVideoTrack;

var availableVideoDevices = []
var urlParams = new URLSearchParams(window.location.search)

var activeRoom;
var previewTracks;
var identity;
var roomName;

// Attach the Tracks to the DOM.
function attachTracks(tracks, container) {
  tracks.forEach(function(track) {
    container.appendChild(track.attach());
  });
}

// Attach the Participant's Tracks to the DOM.
function attachParticipantTracks(participant, container) {
  var tracks = Array.from(participant.tracks.values());
  attachTracks(tracks, container);
}

// Detach the Tracks from the DOM.
function detachTracks(tracks) {
  tracks.forEach(function(track) {
    track.detach().forEach(function(detachedElement) {
      detachedElement.remove();
    });
  });
}

// Detach the Participant's Tracks from the DOM.
function detachParticipantTracks(participant) {
  var tracks = Array.from(participant.tracks.values());
  detachTracks(tracks);
}

// Successfully connected!
function roomJoined(room) {
  window.room = activeRoom = room;

  log("Joined as '" + identity + "'");
  document.getElementById('button-join').style.display = 'none';
  document.getElementById('button-join').innerHTML = "Rejoin Room"

  document.getElementById('button-leave').style.display = 'inline';
  document.getElementById('button-mute').disabled = false
  document.getElementById('button-mute').onclick = function (event) {
    let targetButton
    event.target.tagName === "BUTTON" ? targetButton = event.target : targetButton = event.target.parentElement 
    // Disable all local audio track
    room.localParticipant.audioTracks.forEach(function(audioTrack) {
      if (audioTrack.isEnabled) {
        audioTrack.disable()
        targetButton.innerHTML = '<i class="fas fa-microphone-slash"></i>'
      } else {
        audioTrack.enable()
        targetButton.innerHTML = '<i class="fas fa-microphone"></i>'
      }
    })
  }

  // Attach LocalParticipant's Tracks, if not already attached.
  var previewContainer = document.getElementById('local-media');
  if (!previewContainer.querySelector('video')) {
    attachParticipantTracks(room.localParticipant, previewContainer);
  }

  // Attach the Tracks of the Room's Participants.
  room.participants.forEach(function(participant) {
    log("Already in Room: '" + participant.identity + "'");
    var previewContainer = document.getElementById('remote-media');
    attachParticipantTracks(participant, previewContainer);
  });

  // When a Participant joins the Room, log the event.
  room.on('participantConnected', function(participant) {
    log("Joining: '" + participant.identity + "'");
  });

  // When a Participant adds a Track, attach it to the DOM.
  room.on('trackAdded', function(track, participant) {
    log(participant.identity + " added track: " + track.kind);
    var previewContainer = document.getElementById('remote-media');
    attachTracks([track], previewContainer);
  });

  // When a Participant removes a Track, detach it from the DOM.
  room.on('trackRemoved', function(track, participant) {
    log(participant.identity + " removed track: " + track.kind);
    detachTracks([track]);
  });

  // When a Participant leaves the Room, detach its Tracks.
  room.on('participantDisconnected', function(participant) {
    log("Participant '" + participant.identity + "' left the room");
    detachParticipantTracks(participant);
  });

  // Once the LocalParticipant leaves the room, detach the Tracks
  // of all Participants, including that of the LocalParticipant.
  room.on('disconnected', function() {
    log('Left');
    if (previewTracks) {
      previewTracks.forEach(function(track) {
        track.stop();
      });
      previewTracks = null;
    }
    detachParticipantTracks(room.localParticipant);
    room.participants.forEach(detachParticipantTracks);
    activeRoom = null;
    document.getElementById('button-join').style.display = 'inline';
    document.getElementById('button-leave').style.display = 'none';
    document.getElementById('button-mute').disabled = true
    document.getElementById('button-mute').innerHTML = '<i class="fas fa-microphone"></i>'
  });
}

// Preview LocalParticipant's Tracks.
document.getElementById('button-preview').onclick = function() {
  var localTracksPromise = previewTracks
    ? Promise.resolve(previewTracks)
    : Video.createLocalTracks();

  localTracksPromise.then(function(tracks) {
    window.previewTracks = previewTracks = tracks;
    var previewContainer = document.getElementById('local-media');
    if (!previewContainer.querySelector('video')) {
      attachTracks(tracks, previewContainer);
    }
  }, function(error) {
    console.error('Unable to access local media', error);
    log('Unable to access Camera and Microphone');
  });
};

// Activity log.
function log(message) {
  var logDiv = document.getElementById('log');
  logDiv.innerHTML += '<p>&gt;&nbsp;' + message + '</p>';
  logDiv.scrollTop = logDiv.scrollHeight;
}

// Leave Room.
function leaveRoomIfJoined() {
  if (activeRoom) {
    activeRoom.disconnect();
  }
}

function initInterface() {
  // Bind button to join Room.
  document.getElementById('button-join').onclick = function() {
    joinRoom()
  };
  // Bind button to leave Room.
  document.getElementById('button-leave').onclick = function() {
    log('Leaving room...');
    activeRoom.disconnect();
  };
  // Get video device list
  getDeviceSelectionOptions().then(deviceSelectionOptions => {
    availableVideoDevices = []
    deviceSelectionOptions.videoinput.forEach(videoInput => {
      availableVideoDevices.push(videoInput.deviceId)
    })
    if (availableVideoDevices.length > 1) {
      document.querySelector('#button-camera').style.display = 'inline';
      document.querySelector('#button-camera').value = availableVideoDevices[0]
      document.querySelector('#button-camera').onclick = function(event) {
        var video = document.querySelector('div#local-media video');
        if (event.target.value === availableVideoDevices[0]) {
          event.target.value = availableVideoDevices[1]
          publishVideoTrack(availableVideoDevices[1], activeRoom, video);
          event.target.textContent = "Back Camera"
          event.target.textContent(availableVideoDevices[1])

        } else {
          event.target.value = availableVideoDevices[0]
          publishVideoTrack(availableVideoDevices[0], activeRoom, video);
          event.target.textContent = "Default Camera"
        }
      }
    }
  })
  // Init Join button
  if (!urlParams.has('room')) {
    document.getElementById('button-join').disabled = true;
    alert('No room name specified in url!\Add "?room=<room-name>" to the URL');
    return;
  }
}

function joinRoom() {
  // Obtain a token from the server in order to connect to the Room.
  $.getJSON('/token', function(data) {
    roomName = urlParams.get('room');
    log("Joining room '" + roomName + "'...");
    var connectOptions = {
      name: roomName,
      logLevel: 'debug'
    };
    
    if (previewTracks) {
      connectOptions.tracks = previewTracks;
    }
    
    // Join the Room with the token from the server and the
    // LocalParticipant's Tracks.
    Video.connect(data.token, connectOptions).then(roomJoined, function(error) {
      log('Could not connect to Twilio: ' + error.message);
    });
    
    identity = data.identity;
  });
}

// When we are about to transition away from this page, disconnect
// from the room, if joined.
window.addEventListener('beforeunload', leaveRoomIfJoined);
initInterface()
