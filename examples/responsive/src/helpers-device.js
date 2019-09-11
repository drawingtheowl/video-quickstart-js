'use strict';

var Video = require('twilio-video');

/**
 * Get the list of available media devices of the given kind.
 * @param {Array<MediaDeviceInfo>} deviceInfos
 * @param {string} kind - One of 'audioinput', 'audiooutput', 'videoinput'
 * @returns {Array<MediaDeviceInfo>} - Only those media devices of the given kind
 */
function getDevicesOfKind(deviceInfos, kind) {
  return deviceInfos.filter(function(deviceInfo) {
    return deviceInfo.kind === kind;
  });
}

/**
 * Get the list of available media devices.
 * @returns {Promise<DeviceSelectionOptions>}
 * @typedef {object} DeviceSelectionOptions
 * @property {Array<MediaDeviceInfo>} audioinput
 * @property {Array<MediaDeviceInfo>} audiooutput
 * @property {Array<MediaDeviceInfo>} videoinput
 */
function getDeviceSelectionOptions() {
  return navigator.mediaDevices.enumerateDevices().then(function(deviceInfos) {
    var kinds = [ 'audioinput', 'audiooutput', 'videoinput' ];
    return kinds.reduce(function(deviceSelectionOptions, kind) {
      deviceSelectionOptions[kind] = getDevicesOfKind(deviceInfos, kind);
      return deviceSelectionOptions;
    }, {});
  });
}

// Attach video track to DOM element
function attachVideoTrackToElement(track, video) {
  track.attach(video)
}

// Create (from deviceId) and publish a video track
function publishVideoTrack(deviceId, room, preview) {
  return Video.createLocalVideoTrack({
    deviceId: deviceId,
    // height: 240,
    // width: 320
  }).then(function(newTrack) {
    // If there is a preview element, attach the new track to that as well
    if (preview) {
      attachVideoTrackToElement(newTrack, preview)
    }
    // Unpublish all local video tracks
    room.localParticipant.videoTracks.forEach(track => {
      room.localParticipant.unpublishTrack(track);
    })
    // Publish the newly created track
    room.localParticipant.publishTrack(newTrack);
  });
}

module.exports.getDeviceSelectionOptions = getDeviceSelectionOptions;
module.exports.publishVideoTrack = publishVideoTrack;
