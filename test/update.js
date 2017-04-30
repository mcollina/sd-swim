/* eslint no-console:0 */

const Lab = require('lab')
const lab = exports.lab = Lab.script()
const assert = require('power-assert')
const Update = require('../lib/update')
const SDSwim = require('../lib/sd-swim')
const {nodeStates: {ALIVE, SUSPECT, FAULTY}} = require('../lib/states')
const {describe, it, beforeEach, afterEach} = lab

describe('Update', () => {

  let node
  beforeEach(done => {
    node = new SDSwim({port: 12345})
    node.start(done)
  })

  afterEach(done => {
    node.stop(done)
  })

  const host1 = {host: 'host1', port: 1234}
  const host2 = {host: 'host2', port: 5678}
  const host3 = {host: 'host3', port: 5679}

  it('should create an alive update correctly', done => {
    const update = new Update({sdswim: node})
    const expected = [{node: host1, setBy: host2, state: ALIVE, incNumber: 0}]
    update.addUpdate(host1, host2, ALIVE, 0)
    const updates = update.getUpdates()
    assert.deepEqual(updates, expected)
    const temp = update.getUpdates()
    assert.deepEqual([], temp) // no more updates
    done()
  })

  it('should create an alive update correctly passing the state', done => {
    const update = new Update({sdswim: node})
    const expected = [{node: host1, setBy: host2, state: ALIVE, incNumber: 1}]
    update.addUpdate(host1, host2, ALIVE, 1)
    const updates = update.getUpdates()
    assert.deepEqual(updates, expected)
    const temp = update.getUpdates()
    assert.deepEqual(temp, []) // no more updates
    done()
  })

  it('should create a faulty update correctly', done => {
    const update = new Update({sdswim: node})
    const expected = [{node: host1, setBy: host2, state: FAULTY, incNumber: 0}]
    update.addUpdate(host1, host2, FAULTY, 0)
    const updates = update.getUpdates()
    assert.deepEqual(updates, expected)
    assert.deepEqual([], update.getUpdates()) // no more updates
    done()
  })

  it('should create a suspect update correctly', done => {
    const update = new Update({sdswim: node})
    const expected = [{node: host1, setBy: host2, state: SUSPECT, incNumber: 0}]
    update.addUpdate(host1, host2, SUSPECT, 0)
    const updates = update.getUpdates()
    assert.deepEqual(updates, expected)
    assert.deepEqual(update.getUpdates(), []) // no more updates
    done()
  })

  it('should create a list of updates <= updatesMaxSize', done => {
    const update = new Update({sdswim: node})
    const expected = [
      {node: host1, setBy: host2, state: SUSPECT, incNumber: 0},
      {node: host1, setBy: host2, state: FAULTY, incNumber: 0},
      {node: host1, setBy: host2, state: ALIVE, incNumber: 0},
      {node: host1, setBy: host2, state: ALIVE, incNumber: 0}
    ]
    update.addUpdate(host1, host2, SUSPECT, 0)
    update.addUpdate(host1, host2, FAULTY, 0)
    update.addUpdate(host1, host2, ALIVE, 0)
    update.addUpdate(host1, host2, ALIVE, 0)
    const updates = update.getUpdates()
    assert.deepEqual(updates, expected)
    assert.deepEqual(update.getUpdates(), []) // no more updates
    done()
  })

  it('should create a list of updates > updatesMaxSize and return it correctly', done => {
    const update = new Update({updatesMaxSize: 3})
    const expected = [
      {node: host1, setBy: host2, state: SUSPECT, incNumber: 0},
      {node: host1, setBy: host2, state: FAULTY, incNumber: 0},
      {node: host1, setBy: host2, state: ALIVE, incNumber: 0}
    ]
    const moreExpected = [
      {node: host1, setBy: host2, state: ALIVE, incNumber: 0}
    ]
    update.addUpdate(host1, host2, SUSPECT, 0)
    update.addUpdate(host1, host2, FAULTY, 0)
    update.addUpdate(host1, host2, ALIVE, 0)
    update.addUpdate(host1, host2, ALIVE, 0)
    const updates = update.getUpdates()
    assert.deepEqual(updates, expected)
    const moreUpdates = update.getUpdates()
    assert.deepEqual(moreUpdates, moreExpected)
    assert.deepEqual(update.getUpdates(), []) // no more updates
    done()
  })

  describe('Given an ALIVE update', () => {

    it('should process an ALIVE update correctly with unknown member', done => {
      const update = node.opts.update
      const updateToAlive = {
        node: host1,
        state: ALIVE,
        setBy: host2,
        incNumber: 0
      }
      update.processUpdates([updateToAlive])
      assert.deepEqual(node.memberList, [host1])
      assert.deepEqual(node.opts.members.list, [updateToAlive])
      assert.deepEqual(update.getUpdates(), [updateToAlive])
      done()
    })

    it('should process an ALIVE update correctly with member with incNumber < than the update', done => {
      const update = node.opts.update
      const updateToAlive = {node: host1, state: ALIVE, setBy: host2, incNumber: 0}
      update.processUpdates([updateToAlive])
      assert.deepEqual(update.getUpdates(), [updateToAlive])
      const newUpdateToAlive = {node: host1, state: ALIVE, setBy: host3, incNumber: 1}
      update.processUpdates([newUpdateToAlive])
      assert.deepEqual(node.memberList, [host1])
      assert.deepEqual(node.opts.members.list, [newUpdateToAlive])
      assert.deepEqual(update.getUpdates(), [newUpdateToAlive])
      done()
    })

    it('should process an ALIVE update correctly with member with incNumber >= than the update', done => {
      const update = node.opts.update
      const updateToAlive = {node: host1, state: ALIVE, setBy: host2, incNumber: 1}
      update.processUpdates([updateToAlive])
      const newUpdateToAlive = {node: host1, state: ALIVE, setBy: host3, incNumber: 0}
      update.processUpdates([newUpdateToAlive])
      assert.deepEqual(node.memberList, [host1])
      assert.deepEqual(node.opts.members.list, [updateToAlive])
      assert.deepEqual(update.getUpdates(), [updateToAlive])
      done()
    })

    it('should process an ALIVE update correctly with a SUSPECT member with incNumber <= than the update', done => {
      const update = node.opts.update
      const updateToSuspect = {node: host1, state: SUSPECT, setBy: host2, incNumber: 0}
      update.processUpdates([updateToSuspect])
      const newUpdateToAlive = {node: host1, state: ALIVE, setBy: host3, incNumber: 1}
      update.processUpdates([newUpdateToAlive])
      assert.deepEqual(node.memberList, [host1])
      assert.deepEqual(node.opts.members.list, [newUpdateToAlive])
      done()
    })
  })

  describe('Given an SUSPECT update', () => {

    it('should process an SUSPECT update correctly when target is ME', done => {
      // a new ALIVE message must be produces with incNumber incremented
      const update = node.opts.update
      node.host = host1.host
      node.port = host1.port
      const updateToSuspect = {
        node: host1,
        state: SUSPECT,
        setBy: host2,
        incNumber: 0
      }
      update.processUpdates([updateToSuspect])
      assert.deepEqual(node.memberList, [host1])

      const expectedMember = {
        node: host1,
        state: ALIVE,
        setBy: host1,
        incNumber: 1
      }
      assert.deepEqual(node.opts.members.list, [expectedMember])
      assert.deepEqual(update.getUpdates(), [expectedMember])
      done()
    })

    it('should process an SUSPECT update correctly with unknown member', done => {
      const update = node.opts.update
      const updateToSuspect = {
        node: host1,
        state: SUSPECT,
        setBy: host2,
        incNumber: 0
      }
      update.processUpdates([updateToSuspect])
      assert.deepEqual(node.memberList, [host1])
      assert.deepEqual(node.opts.members.list, [updateToSuspect])
      assert.deepEqual(update.getUpdates(), [updateToSuspect])
      done()
    })

    it('should process an SUSPECT update correctly with a ALIVE member with incNumber < than the update', done => {
      const update = node.opts.update
      const updateToAlive = {node: host1, state: ALIVE, setBy: host2, incNumber: 0}
      update.processUpdates([updateToAlive])
      assert.deepEqual(update.getUpdates(), [updateToAlive])

      const newUpdateToSuspect = {node: host1, state: SUSPECT, setBy: host3, incNumber: 1}
      update.processUpdates([newUpdateToSuspect])
      assert.deepEqual(node.memberList, [host1])
      assert.deepEqual(node.opts.members.list, [newUpdateToSuspect])
      assert.deepEqual(update.getUpdates(), [newUpdateToSuspect])
      done()
    })

    it('should ignore a SUSPECT update when ALIVE member with incNumber >= than the update', done => {
      const update = node.opts.update
      const updateToAlive = {node: host1, state: ALIVE, setBy: host2, incNumber: 1}
      update.processUpdates([updateToAlive])
      assert.deepEqual(update.getUpdates(), [updateToAlive])

      const newUpdateToSuspect = {node: host1, state: SUSPECT, setBy: host3, incNumber: 0}
      update.processUpdates([newUpdateToSuspect])
      assert.deepEqual(node.memberList, [host1])
      assert.deepEqual(node.opts.members.list, [updateToAlive])
      assert.deepEqual(update.getUpdates(), [])
      done()
    })

    it('should process a SUSPECT update correctly with a SUSPECT member with incNumber <= than the update', done => {
      const update = node.opts.update
      const updateToSuspect = {node: host1, state: SUSPECT, setBy: host2, incNumber: 0}
      update.processUpdates([updateToSuspect])
      assert.deepEqual(update.getUpdates(), [updateToSuspect])

      const newUpdateToSuspect = {node: host1, state: SUSPECT, setBy: host3, incNumber: 1}
      update.processUpdates([newUpdateToSuspect])
      assert.deepEqual(node.memberList, [host1])
      assert.deepEqual(node.opts.members.list, [newUpdateToSuspect])
      assert.deepEqual(update.getUpdates(), [newUpdateToSuspect])
      done()
    })

    it('should ignore a SUSPECT update correctly with a SUSPECT member with incNumber > than the update', done => {
      const update = node.opts.update
      const updateToSuspect = {node: host1, state: SUSPECT, setBy: host2, incNumber: 1}
      update.processUpdates([updateToSuspect])
      assert.deepEqual(update.getUpdates(), [updateToSuspect])

      const newUpdateToSuspect = {node: host1, state: SUSPECT, setBy: host3, incNumber: 0}
      update.processUpdates([newUpdateToSuspect])
      assert.deepEqual(node.memberList, [host1])
      assert.deepEqual(node.opts.members.list, [updateToSuspect])
      assert.deepEqual(update.getUpdates(), [])
      done()
    })

  })

})
