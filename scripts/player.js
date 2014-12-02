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
    'hft/misc/input',
    'hft/misc/misc',
    '../bower_components/hft-utils/dist/gamebutton',
    '../bower_components/hft-utils/dist/imageutils',
  ], function(
    Input,
    Misc,
    GameButton,
    ImageProcess) {

  var availableColors = [];
  var nameFontOptions = {
    font: "40px sans-serif",
    yOffset: 36,
    height: 44,
    fillStyle: "white",
    backgroundColor: "rgba(0,0,0,0.5)",
  };

  /**
   * Player represents a player in the game.
   * @constructor
   */
  var Player = (function() {
    return function(services, position, name, netPlayer) {
      this.services = services;
      this.renderer = services.renderer;
      this.roundsPlayed = 0;
      this.wins = 0;

      // add the button before the player so it will get
      // processed first.
      this.abutton = new GameButton(services.entitySystem);
      this.sprite = this.services.spriteManager.createSprite();
      this.nameSprite = this.services.spriteManager.createSprite();


this.anims = {
  idle: 'avatarStandR',
  walk: ['avatarWalkU0', 'avatarWalkU1'],
};

      services.entitySystem.addEntity(this);
      services.drawSystem.addEntity(this);
      this.netPlayer = netPlayer;
      this.position = position;

      if (availableColors.length == 0) {
        var avatar = this.services.images.avatar;
        for (var ii = 0; ii < 64; ++ii) {
          availableColors.push({
            hsv: [ii % 16 / 16, 0, 0, 0],
            set: ii / 16 | 0,
          });
        }
      }

      this.nameTextures = {
      };

      this.color = availableColors[Math.floor(Math.random() * availableColors.length)];
      availableColors.splice(this.color, 1);
      this.sendCmd('setColor', this.color);
      this.setName(name);

      this.imageSet = this.services.images.avatar[this.color.set];

      var images = this.services.images;

      this.textures = {
        u_texture: this.imageSet.avatarStandU,
      };

      netPlayer.addEventListener('disconnect', Player.prototype.handleDisconnect.bind(this));
      netPlayer.addEventListener('o', Player.prototype.handleOMsg.bind(this));
      netPlayer.addEventListener('abutton', Player.prototype.handleAButtonMsg.bind(this));
      netPlayer.addEventListener('show', Player.prototype.handleShowMsg.bind(this));
      netPlayer.addEventListener('setName', Player.prototype.handleNameMsg.bind(this));
      netPlayer.addEventListener('busy', Player.prototype.handleBusyMsg.bind(this));

      this.setState('waiting');
    };
  }());

  Player.prototype.reset = function(x, y) {
    var globals = this.services.globals;
    this.setPosition(x, y);
    this.sprite.uniforms.u_hsvaAdjust = this.color.hsv.slice();
    this.inRow = true; // false = in column
    this.playing = true;
    this.alive = true;
    this.display = true;
    this.scale = 1;
    this.rotation = 0;
    this.animTimer = 0;
    this.setAnimFrame(this.anims.idle);
    this.setState('start');
  };

  Player.prototype.reportDied = function() {
    if (this.alive) {
      this.alive = false;
      this.services.playerManager.playerDied();
    }
  };

  Player.prototype.setAnimFrame = function(name) {
    this.textures.u_texture = this.imageSet[name];
  };

  Player.prototype.setFacing = function(direction) {
    var oldFacing = this.facing;
    this.facing = direction;
    this.facingInfo = directionInfo[direction];
    this.hflip = this.facingInfo.hflip;
    if (this.facingInfo.noChangeDirs.indexOf(oldFacing) < 0) {
      this.anims = this.facingInfo.anims;
    }
  };

  Player.prototype.setPosition = function(x, y) {
    this.position[0] = x;
    this.position[1] = y;
  };

  Player.prototype.sendWinner = function() {
    this.sendCmd('winner');
  };

  Player.prototype.sendTied = function() {
    this.sendCmd('tied');
  };

  Player.prototype.deleteNameImage = function() {
    if (this.nameTextures.u_texture) {
      this.nameTextures.u_texture.destroy();
      delete this.nameTextures.u_texture;
    }
  };

  Player.prototype.setName = function(name) {
    if (name != this.playerName) {
      this.playerName = name;
      this.deleteNameImage();
      this.nameTextures.u_texture = this.services.createTexture(
          ImageProcess.makeTextImage(name, nameFontOptions));
    }
  };

  Player.prototype.setState = function(state) {
    this.state = state;
    var init = this["init_" + state];
    if (init) {
      init.call(this);
    }
    this.process = this["state_" + state];
  };

  Player.prototype.removeFromGame = function() {
    this.reportDied();
    this.deleteNameImage();
    this.services.entitySystem.removeEntity(this);
    this.services.drawSystem.removeEntity(this);
    this.services.playerManager.removePlayer(this);
    this.services.spriteManager.deleteSprite(this.sprite);
    this.services.spriteManager.deleteSprite(this.nameSprite);
    this.abutton.destroy();
    availableColors.push(this.color);
  };

  Player.prototype.handleDisconnect = function() {
    this.removeFromGame();
  };

  Player.prototype.handleBusyMsg = function(msg) {
    // We ignore this message
  };

  Player.prototype.handleOMsg = function(msg) {
    var x = msg.x / 1000 * 0.5 + 0.5;
    this.setPosition(x, 0.8);
  };

  Player.prototype.handleAButtonMsg = function(msg) {
    this.abutton.setState(msg.abutton);
  };

  Player.prototype.handleShowMsg = function(msg) {
    this.userRequestShowName = msg.show;
  };


  Player.prototype.handleNameMsg = function(msg) {
    if (!msg.name) {
      this.sendCmd('setName', {
        name: this.playerName
      });
    } else {
     this.setName(msg.name.replace(/[<>]/g, ''));
    }
  };

  Player.prototype.sendCmd = function(cmd, data) {
    this.netPlayer.sendCmd(cmd, data);
  };

  // This state is when the round has finished.
  // Show the character but don't update anything.
  Player.prototype.init_end = function() {
  };

  Player.prototype.state_end = function() {
  };

  // This state is when you're waiting to join a game.
  // Don't show any characters.
  Player.prototype.init_waiting = function() {
    this.display = false;
    this.alive = false;
    this.sendCmd('waitForNextGame'); //??
  };

  Player.prototype.state_waiting = function() {
  };

  // This state is just before the game has started
  Player.prototype.init_start = function() {
    // player.reset will have just been called.
    this.showName = true;
    this.sendCmd('start');
  };

  Player.prototype.state_start = function() {
  };

  Player.prototype.init_idle = function() {
    this.showName = false;
  };

  Player.prototype.state_idle = function() {
    this.setAnimFrame(this.anims.idle);
  };

  Player.prototype.init_die = function() {
    this.services.audioManager.playSound('die');
    this.sendCmd('died');
    this.reportDied();
    this.dieTimer = 0;
  };

  Player.prototype.state_die = function() {
    var globals = this.services.globals;
    this.sprite.uniforms.u_hsvaAdjust[0] += globals.dieColorSpeed * globals.elapsedTime;
    this.sprite.uniforms.u_hsvaAdjust[2] = (globals.frameCount & 2) ? 1 : 0;
    this.rotation += globals.dieRotationSpeed * globals.elapsedTime;
    this.dieTimer += globals.elapsedTime;
    if (this.dieTimer >= globals.dieDuration) {
      this.setState('evaporate');
    }
  };

  Player.prototype.init_evaporate = function() {
    this.dieTimer = 0;
  };

  Player.prototype.state_evaporate = function() {
    var globals = this.services.globals;
    this.sprite.uniforms.u_hsvaAdjust[0] += globals.dieColorSpeed * globals.elapsedTime;
    this.sprite.uniforms.u_hsvaAdjust[2] = (globals.frameCount & 2) ? 1 : 0;
    this.rotation += globals.dieRotationSpeed * globals.elapsedTime;
    this.scale += globals.dieScaleSpeed * globals.elapsedTime;
    this.dieTimer += globals.elapsedTime;
    var a = this.dieTimer / globals.evaporateDuration;
    this.sprite.uniforms.u_hsvaAdjust[3] = -a;
    if (this.dieTimer >= globals.evaporateDuration) {
      this.setState('dead');
    }
  };

  Player.prototype.init_dead = function() {
    this.display = false;
    this.dieTimer = 2;
  };

  Player.prototype.state_dead = function() {
    var globals = this.services.globals;
    this.dieTimer -= globals.elapsedTime;
    if (this.dieTimer <= 0) {
      if (this.services.gameManager.state != 'play') {
        this.setState('end');
      } else {
        this.setState('reappear');
      }
    }
  };

  Player.prototype.draw = function(renderer) {
    this.sprite.visible = this.display;
    this.nameSprite.visible = this.display;
    if (!this.display) {
      return;
    }
    var canvas = this.services.canvas;
    var globals = this.services.globals;
    var images = this.services.images;
    var spriteRenderer = this.services.spriteRenderer;
    var off = { x: 0, y: 0 };

    var scale  = globals.scale * this.scale;
    var width  = 16 * scale;
    var height = 16 * scale;

    var sprite = this.sprite;
    sprite.uniforms.u_texture = this.textures.u_texture;
    sprite.x = this.position[0] * canvas.width;
    sprite.y = this.position[1] * canvas.height;
    sprite.width = 80;
    sprite.height = 20;
    sprite.rotation = this.rotation;
    sprite.xScale = 1;
    sprite.yScale = 1;

    if (!this.hideName && (this.showName || this.userRequestShowName)) {
      var nameSprite = this.nameSprite;
      var width  = this.nameTextures.u_texture.img.width  / 4;
      var height = this.nameTextures.u_texture.img.height / 4;
      var x = off.x + this.position[0] * globals.scale;
      var y = off.y + (this.position[1] - height - 2) * globals.scale

      width  *= globals.scale;
      height *= globals.scale;

      nameSprite.uniforms.u_texture = this.nameTextures.u_texture;
      nameSprite.x = x,
      nameSprite.y = y,
      nameSprite.width = width,
      nameSprite.height = height,
      nameSprite.visible = true;
    } else {
      this.nameSprite.visible = false;
    }
  };

  return Player;
});

