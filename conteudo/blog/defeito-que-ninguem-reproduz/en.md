The ticket arrives like this: *"error when saving the order"*, with a screenshot of the red message on screen.

The developer opens it, tries it, saves. It works. The ticket goes back asking for more information. The key user replies that it happened, that they saw it, and that they cannot explain it any better. Third day, the ticket is still open, and both people are annoyed.

Nobody did anything wrong. The report was honest and the developer's test was honest. The problem is structural: **the report describes the outcome, and reproduction requires the input.** They are different pieces of information, and usually only one of them survives.

## What is missing, item by item

A defect in an ERP rarely depends on the transaction alone. It depends on a set of conditions nobody wrote down because, at the time, they seemed obvious:

- **Who executed it** — and above all with which authorization profile. Half of every "works for me" dies on this line: the developer tests with a broad profile and the user has another.
- **Which environment**, and with which transport applied. Two systems with similar names and one difference in the transport queue already explain different behaviour.
- **Which master data** — material, customer, vendor, plant, sales organization. The error is almost never "in the order"; it is "with that material, for that customer, in that organization".
- **Which variant or layout** was selected. A mandatory field that shows up for one person and not another is usually screen configuration, not a bug.
- **The exact sequence**, including what the person did before. Plenty of defects only occur when you arrive by route B, or after coming back from another screen.
- **The time** — which matters more than it seems when there are nightly jobs, scheduled integrations or locks held by another user.
- **What appeared before the final message.** There is usually a yellow warning two steps earlier that nobody read and nobody kept.

The screenshot carries none of those seven. It shows the end of the story.

## The cost nobody counts

The bounce-back cycle has a price, and it is paid three times.

First: **both sides' time.** Every round trip consumes a developer's attention and a business user's, when both had something else to do.

Second: **the cycle deadline.** A ticket ping-ponging for three days is a scenario that does not close, and a scenario that does not close pushes the date.

Third, and this is the most expensive and the quietest: **a defect closed as "not reproducible" that shows up in production.** There the cost changes order of magnitude, and the argument that follows — was it tested or not — gets settled by whoever shouts, because nobody has a record.

## Why "describe it better" does not work

Every coordinator's natural reaction is to ask for a more detailed report. A bigger form, one more mandatory field, training on how to open a ticket.

That helps a little and fails for the same old reason: **it asks for discipline at the worst moment.** The person has just lost ten minutes to an error, is behind on their own script, and now has to stop and reconstruct from memory seven conditions they did not even know mattered.

They will write "error when saving". And they are right to write that, because that is what they know.

## The inversion that works

The path that works is not asking for more description. It is **capturing the execution**, and leaving description for what the capture cannot get.

When a record of the execution exists — the sequence of screens, with time, and with what the person was saying while doing it — the developer does not need a report. They can see. And the seven conditions appear on their own: the profile is on the entry screen, the environment is in the system header, the master data is in the filled fields, the sequence is the recording itself, and the yellow warning nobody read is right there, two steps before the error.

The report stops being the source of truth and becomes the index: *"the error is at minute 3"*.

## Where this does not apply

- **An ABAP dump already has everything.** If the error produced a dump, it contains user, time, program, line and the call stack. Screen capture is redundant there — go straight to the dump.
- **Automated tests do not need this.** The runner logs input, output, time and captures on failure, better than any human would.
- **Performance problems need different instrumentation.** Slowness is investigated with measurement, not video — though a recording helps show what the person was doing when it got slow.
- **Errors with sensitive data on screen** require redaction before anything circulates, and that applies to screenshots, video or documents alike. Recording does not remove the duty of care.

## What you can change this week

- **Ask for the recording alongside the ticket**, not instead of it. Two lines of report plus the execution record beat a ten-field form.
- **Teach the team one sentence**: narrate out loud what you are doing while you do it. It costs nothing and turns a recording into an explanation.
- **Standardize the opening**: show the environment and the user at the start. That solves two of the seven conditions with no extra effort.
- **Create the return rule**: a defect sent back for missing information comes back with the **input**, not with more adjectives. "Not reproducible" without input is not a conclusion, it is an open item.
- **Store the evidence with the case**, not in a parallel folder. Evidence that lives far from the case is evidence nobody finds three months later.

## Where Walkstamp fits

Walkstamp turns the recording of an execution into a document — and that is what closes the ticket loop.

The person records the screen and reproduces the scenario while narrating. The tool isolates the moments when the screen changes, including the warnings and errors that appeared along the way, and builds a document with clock time per step, the declared environment (DEV, QA, PRD or sandbox) and the speech paired with each segment. Output is PDF, Word, HTML or Markdown, in a file that fits a ticket attachment — with [ready-made links for Zephyr, Jira and TestRail](/en), where defects usually live.

It does not reproduce the defect for you, does not analyse root cause, and does not replace the dump when there is one. It does one thing: it hands the developer the input that was missing, in a format they can read in thirty seconds.

And the video never leaves your machine — the whole process runs in the browser, with no server in the path, which tends to settle the information security conversation before it starts. It is all on the [Security page](/en/seguranca). It is free and needs no account: you can [open it now](/en) with any recording.

I have written before about [the four things a screenshot loses](/en/blog/what-a-screenshot-loses) and about [evidence that survives an audit](/en/blog/evidence-an-auditor-accepts). This article is the same reasoning in the cheapest place to test it: **the ticket that bounces back.**

If you coordinate acceptance testing, there is a number that is easy to pull and uncomfortable to look at: **how many of your defects were returned for missing information in the last cycle?** It is the most honest metric about the quality of your records — and it does not depend on anyone's opinion.