# test/ — checks that run before anything ships

**Not for you.** Three files that prove the rules still hold: that saved data
keeps its shape, that a 9pm workout lands on today and not tomorrow, and that
one client's data can never be read by another.

Run them all:

    node test/local-adapter.test.mjs
    node test/schema.test.mjs
    node test/store.test.mjs

They are deliberately kept out of the app's offline shell — see the note in
`build-sw.mjs`.
