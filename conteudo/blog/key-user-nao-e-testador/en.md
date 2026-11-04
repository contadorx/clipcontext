In the middle of an acceptance cycle, a key user raises a hand and says the sentence that sums up the whole problem:

*"It passed, but something looks off here."*

The coordinator asks what. He hesitates, looks at the screen again, and answers: *"I can't explain it properly, but this value doesn't usually come out like that."*

She thanks him, he marks the case as approved — because the result matched what was expected — and both move on. That sentence had nowhere to be recorded.

Three months later, in production, the value that did not usually come out like that becomes a ticket.

## Two different questions

A test script asks one thing: **did it pass?** Steps executed, result matched, mark approved.

The key user can answer another one, that nobody asked: **is it right?**

He does not compare the result with the script. He compares it with the operation he knows — which is why he notices what the script never anticipated: a field that is always filled and this time came out empty, a plausible but suspiciously high value, an order of steps that in practice runs differently, a customer who in real life would never do that.

**This is the most valuable thing that happens in acceptance testing.** No script produces it, because a script only finds what its author already imagined.

And that is precisely the information the project has nowhere to store.

## Why the key user is the best defect detector

He brings what nobody else on the project has: **the memory of the real operation.**

The consultant knows the system. The tester knows testing technique. The analyst knows the design. Only the key user knows that this customer always buys at month end, that this material has an exception nobody documented, and that the rule written in the design is not the one the area has practiced since 2019.

In acceptance testing, his value is not in executing steps. **It is in finding things odd.**

## And why he is the worst documenter — through no fault of his own

Here is the part projects tend to treat as a discipline failure, and it is not.

**It is not his job.** He has a role, targets and a queue that did not pause because the project started. Testing is overtime on top of his actual work.

**He is between two meetings.** His window is short and fragmented. Documenting later means at the end of the day, when he still has the operation to close.

**The form's vocabulary is not his.** "Expected result", "precondition", "severity". He knows what happened; he does not know how to translate it into the spreadsheet.

**And what he saw does not fit the field.** "Passed" or "failed" leaves no room for "passed, but it looks off". So he marks passed, which is the formal truth, and the observation evaporates.

Asking him to "describe it better" is asking for discipline at the worst moment — the same mistake as [when a defect comes back marked "could not reproduce"](/en/blog/the-defect-nobody-can-reproduce).

## The second loss, worse than the first

When the key user's observation has no destination, something quiet happens: **he learns that it does not fit.**

The first time, he speaks up. The second, more briefly. The third, he marks approved and says nothing — because raising it costs him time, and nobody came back to him last time.

The project reads this as cycle maturity: less noise, more cases approved, a nice curve. It is the opposite. **The detector was switched off, and the dashboard turned greener exactly when it became less trustworthy.**

## Where this reasoning does not apply

- **Key users do not replace professional testing.** Mass regression, integration, load and security testing require test people, technique and tooling. Acceptance is one layer, not the only one.
- **Not every key user knows the process.** Some know the transaction and not the business, and then the "oddness" never comes — which is not a character flaw, it is a sign that the person picked may not be right for that scenario.
- **Not every oddness is a defect.** A good share is process change the person has not digested yet, and the work there is to explain, not to fix. But you can only separate the two after recording it.
- **If your cycle already has a dedicated analyst shadowing every session**, you have solved this article's problem another way — and a more expensive one.

## What I would change in your next cycle

- **Split the two questions in the form.** One field for "passed" and another for "was it what you expected?". Two clicks, and the second is where the gold is.
- **Ask for observation, not description.** "What caught your attention?" is a question a key user can answer. "Describe the anomalous behaviour" is not.
- **Ask for narration out loud during execution.** It is the cheapest way to capture what he is thinking while he looks — and it is exactly where "this usually comes filled in" shows up.
- **Create a destination for doubt.** A list of "odd things", separate from defects, reviewed by someone who knows the process. With no destination, the observation dies and the detector switches off.
- **Close every session with fifteen minutes.** Not to fill in a spreadsheet: to ask "was there anything that bothered you and you didn't know where to put?".
- **And give feedback.** Every recorded oddness needs a verdict back, even if it is "that is expected, it changed because of the new rule". Feedback is what keeps the person talking.

## Where Walkstamp fits

Walkstamp solves one specific part of this: **turning what the key user says while executing into a record, without asking him to stop and document.**

He records the screen and runs the scenario while narrating. The tool isolates the moments when the screen changes and builds a document with clock time per step, the environment, and **the speech paired with each segment**. The "this value doesn't usually come out like that" ends up right there, next to the screen where it was said, with a timestamp — instead of evaporating in the corridor.

Output is PDF, Word, HTML or Markdown, with ready-made links for attaching in Zephyr, Jira and TestRail.

What it does not do: it does not judge whether the oddness is a defect, does not write the script, and does not replace the fifteen-minute conversation at the end of the session. It makes sure the observation exists somewhere when that conversation happens.

And the video never leaves the machine of whoever is executing — the whole process runs in the browser, which tends to settle the information security conversation before it starts. It is all on the [Security page](/en/seguranca). It is free and needs no account: you can [open it now](/en).

One question for your next cycle meeting: **in the last month, how many key user observations were recorded anywhere — and how many came back with an answer?** If the second number is zero, the silence you will get in the next cycle is already booked.