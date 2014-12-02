/*
 * Copyright 2014, Gregg Tavares.
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are
 * met:
 *
 *     * Redistributions of source code must retain the above copyright
 * notice, this list of conditions and the following disclaimer.
 *     * Redistributions in binary form must reproduce the above
 * copyright notice, this list of conditions and the following disclaimer
 * in the documentation and/or other materials provided with the
 * distribution.
 *     * Neither the name of Gregg Tavares. nor the names of its
 * contributors may be used to endorse or promote products derived from
 * this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
 * "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
 * LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
 * A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
 * OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
 * SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
 * LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
 * DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
 * THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
"use strict";

define([
    'hft/misc/misc',
    './player',
  ], function(Misc, Player) {

  var clearOffsets = [
    { x:  0, y:  0, },
    { x:  1, y:  0, },
    { x: -1, y:  0, },
    { x:  0, y:  1, },
    { x:  0, y: -1, },
  ];

  var PlayerManager = function(services) {
    this.services = services;
    this.players = [];
    this.playersPlaying = [];
window.p = this.players;
  };

  PlayerManager.prototype.reset = function() {
    var canvas = this.services.canvas;
    var globals = this.services.globals;

    // now choose random places to start players from valid place.
    this.forEachPlayer(function(player, ii) {
      player.reset(
        0.5, 0.5
      );
    });

    // Players that connect while a session will increase players.length so
    // record the players playing at the time the game starts.
    this.playersPlaying = this.players.slice();
    this.numPlayersAlive = this.players.length;
  };

  PlayerManager.prototype.playerDied = function() {
    --this.numPlayersAlive;
  }

  PlayerManager.prototype.getNumPlayersAlive = function() {
    return this.numPlayersAlive;
  };

  PlayerManager.prototype.getNumPlayersPlaying = function() {
    return this.playersPlaying.length;
  };

  PlayerManager.prototype.getNumPlayersConnected = function() {
    return this.players.length;
  };

  PlayerManager.prototype.startPlayer = function(netPlayer, name) {
    var misc = this.services.misc;
    var position = [
      0.5,
      0.5
    ];
    var player = new Player(this.services, position, name, netPlayer);
    this.players.push(player);
    return player;
  };

  PlayerManager.prototype.removePlayer = function(playerToRemove) {
    var index = this.players.indexOf(playerToRemove);
    if (index >= 0) {
      this.players.splice(index, 1);
    }
    index = this.playersPlaying.indexOf(playerToRemove);
    if (index >= 0) {
      this.playersPlaying.splice(index, 1);
    }
  };

  PlayerManager.prototype.forEachPlayerPlaying = function(callback) {
    for (var ii = 0; ii < this.playersPlaying.length; ++ii) {
      if (callback(this.playersPlaying[ii], ii)) {
        return this;
      }
    }
  };

  PlayerManager.prototype.forEachPlayer = function(callback) {
    for (var ii = 0; ii < this.players.length; ++ii) {
      if (callback(this.players[ii], ii)) {
        return this;
      }
    }
  };

  return PlayerManager;
});

