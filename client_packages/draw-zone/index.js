(() => {
  const prefix = '[drawZone]:'

  const sleep = (s) => new Promise(resolve => setTimeout(resolve, s * 1000))

  const route = new class {
    constructor() {
      this.hudColor = 6
      this.displayOnFoot = true
      this.followPlayer = false
      this.radarThickness = 8
      this.mapThickness = 8
      this._clear = '0xE6DE0561D9232A64'
      this._start = '0xDB34E8D56FC13B08'
      this._addPoint = '0x311438A071DD9B1A'
      this._setRender = '0x900086F371220B6F'
    }

    clear() {
        mp.game.invoke(this._clear)
    }

    start(hudColor, displayOnFoot, followPlayer) {
        mp.game.invoke(
            this._start,
            typeof hudColor !== 'undefined' ? hudColor : this.hudColor,
            typeof displayOnFoot !== 'undefined' ? displayOnFoot : this.displayOnFoot,
            typeof followPlayer !== 'undefined' ? followPlayer : this.followPlayer
        )
    }

    addPoint(x, y, z = 0) {
        mp.game.invoke(this._addPoint, x, y, z)
    }

    setRender(toggle, radarThickness, mapThickness) {
        mp.game.invoke(
            this._setRender,
            toggle,
            typeof radarThickness !== 'undefined' ? radarThickness : this.radarThickness,
            typeof mapThickness !== 'undefined' ? mapThickness : this.mapThickness
        )
    }
  }

  const draw = new class {
    
    constructor() {
      this.userMark = 162
      this.hudColor = 9
      this.thickness = 5
      this.vkSpace = 0x20
      this.vkDelete = 0x2E
      this.enable = false
      this.interval = 0
      this.poly = []
      this.drawPoly = {}
      this.binded = false
      this.commit = this.commit.bind(this)
      this.rollback = this.rollback.bind(this)
    }
    
    async start() {
      if (this.enable) {
        this.toggle(false)
        await sleep(.5)
      }
  
      mp.gui.chat.push(`${prefix} 1. Open map`)
      mp.gui.chat.push(`${prefix} 2. Press "Tab" to place mark on map`)
      mp.gui.chat.push(`${prefix} 3. Move mark to draw lines`)
      mp.gui.chat.push(`${prefix} 4. Press "Space" to save a dot`)
      mp.gui.chat.push(`${prefix} 5. Type /zsave to save coords`)

      this.toggle(true)
    }
  
    stop(err) {
      this.toggle(false)
  
      if (err instanceof Error) {
        mp.console.logError(err.stack)
      }
    }
  
    save() {
      const data = JSON.stringify(this.poly)

      mp.events.callRemote('drawZone.save', JSON.stringify(data))
      mp.gui.chat.push(`${prefix} call remote event drawZone.save, polygon length: ${this.poly.length}`)
    }
  
    async reset() {
      this.toggle(false)
  
      await sleep(.5)
  
      this.toggle(true)
    }
  
    rollback() {
      this.poly = this.poly.slice(0, -1)
      this.refreshRoute()
    }
  
    toggle(enable) {
      clearInterval(this.interval)
      this.enable = enable
      this.clear()
      this.bindKeys()
  
      if (this.enable) {
        this.interval = setInterval(() => this.render(), 0)
      }
    }
  
    bindKeys() {
      if (this.binded) {
        mp.keys.unbind(this.vkSpace, true, this.commit)
        mp.keys.unbind(this.vkDelete, true, this.rollback)
        this.binded = false
      }
  
      if (this.enable) {
        mp.keys.bind(this.vkSpace, true, this.commit)
        mp.keys.bind(this.vkDelete, true, this.rollback)
        this.binded = true
      }
    }
  
    render() {
      try {
        this.fillDrawPoly()
  
        const values = [
          ...this.poly,
          ...Object.values(this.drawPoly),
        ].filter(Boolean)
  
        if (!values.length) {
          return
        }
    
        for (const dot of values) {
          if (dot?.length !== 2) {
            continue
          }
  
          route.addPoint(...dot)
        }
    
        route.setRender(true, this.thickness, this.thickness)
      } catch (err) {
        this.stop(err)
      }
    }
  
    clear() {
      this.poly = []
      this.drawPoly = {}
  
      this.refreshRoute()
    }
  
    fillDrawPoly() {
      const mark = this.getUserMark()
  
      if (!mark || !mp.game.ui.doesBlipExist(mark)) {
        return
      }
  
      const coords = mp.game.ui.getBlipInfoIdCoord(mark)
  
      if (!coords) {
        return
      }
  
      const [x, y] = [
        Number(coords.x.toFixed(4)),
        Number(coords.y.toFixed(4))
      ]
  
      if (!this.drawPoly[mark]) {
        this.drawPoly = Object.keys(this.drawPoly).reduce((acc, current) => {
          if (this.drawPoly[current]) {
            acc = { ...this.drawPoly[current] }
          }
    
          return acc
        }, {})
      }
  
      const [polyX, polyY] = this.drawPoly[mark] || []
      
      if (polyX !== x && polyY !== y) {
        this.drawPoly[mark] = [x, y]
  
        if (!this.poly.length) {
          this.poly = [[x, y]]
        }
  
        this.refreshRoute()
      }
    }
  
    getUserMark() {
      return mp.game.ui.getFirstBlipInfoId(this.userMark)
    }
  
    commit() {
      const [[x, y] = []] = Object.values(this.drawPoly).slice(-1)
  
      if (!x || !y) {
        return
      }
  
      const existPoly = this.findByDot([x, y])
  
      if (existPoly) {
        return
      }
  
      this.poly.push([x, y])
      this.refreshRoute()
    }
  
    findByDot([x, y]) {
      return this.poly.find(([polyX, polyY]) => (
        x === polyX && y === polyY
      ))
    }
  
    refreshRoute() {
      route.clear()
      route.start(this.hudColor)
    }
  }

  const commands = {
    'zonestart': () => draw.start(),
    'zonestop': () => draw.stop(),
    'zonereset': () => draw.reset(),
    'zonesave': () => draw.save(),
    'zstart': () => draw.start(),
    'zstop': () => draw.stop(),
    'zreset': () => draw.reset(),
    'zsave': () => draw.save(),
  }

  commands.zlist = () => {
    Object.keys(commands).forEach(cmd => {
      mp.gui.chat.push(`${prefix} /${cmd}`)
    })
  }

  mp.events.add("playerCommand", (input) => {
    try {
      const [cmd] = input.split(/[ ]+/)
      const callback = commands[cmd]
  
      if (callback) {
        mp.gui.chat.push(`${prefix} Run ${cmd}`)
        callback()
      }
    } catch (err) {
      mp.console.logError(err?.stack)
    }
  })
})()