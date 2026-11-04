Last week I asked a key user, in the middle of the first test cycle of an S/4HANA rollout, how his team was storing evidence of what they were testing. The answer was relaxed:

*"We use AI to generate all the scenario documents. There are about 780 of them. You just take a screenshot and drop it into the matching step. It doesn't take much time."*

He is right. Which is exactly what makes this subject harder than it looks.

When someone says producing evidence is painful, the conversation is easy: show them a faster way. When someone says it is **not** painful, no argument about time will work. Nor should it — their process is good.

But speed and proof are different things. A screenshot is fast precisely because it carries almost nothing with it.

## A screenshot answers two questions

Test evidence has to answer six things without relying on anyone's memory: what was executed, where, by whom, when, how, and what appeared on screen. I wrote about that in [The test evidence an auditor accepts](/en/blog/evidence-an-auditor-accepts).

A screenshot pasted into the right step answers two: **what** (because of where it sits) and **what appeared** (because it is the image).

The other four are left to whoever remembers. And the problem is not people's memory — it is that nobody is asked the next day. They are asked months later.

## Missing 1: clock time

A screenshot has no time inside it. The file has a creation date, which is the date someone saved it, and that disappears the moment the image is pasted into a document, copied into another one, or forwarded by email.

That sounds like a detail until two things need to be compared. Was the posting done before or after the parameter was fixed? Is this error screen from the first cycle or the second? Without time, the answer becomes reconstruction.

And there is one case where time is the entire proof: when what you need to demonstrate is **how long** something took. A process that had to run in five minutes and took forty cannot be demonstrated with two undated screenshots.

## Missing 2: the environment

This is the first question an auditor asks, and the one that most often sinks an evidence pack: **which environment is this from?**

A QA screen and a production screen look identical in most systems. The difference is a colored bar, a server name, or nothing at all. And they prove different things: one shows the scenario works, the other shows it actually worked, with real data.

An evidence document that does not state the environment proves neither. It is a picture of some system.

## Missing 3: the sequence — especially what went wrong

This is the biggest loss, and the quietest.

Whoever runs a test case captures what **seemed important**: the final screen, the success message, the document number. What never becomes a screenshot is the middle — the error that appeared, the field that blocked, the workaround the person found.

That is exactly where the valuable information lives. A case that passed on the first try and a case that passed after three attempts and a workaround carry the same status in the report, and are completely different realities for whoever will operate it in production.

The screenshot does not lose this by accident. It loses it by nature: nobody photographs the error they already solved.

## Missing 4: integrity

This one is almost never discussed, and it matters most when evidence becomes a serious matter.

An image pasted into a document can be cropped, edited, replaced. I am not suggesting bad faith — in practice what happens is mundane: someone retakes the screenshot because the first one was clipped, and pastes the new one without telling anyone. Everything is fine. The document simply has no way to show that it is fine.

Strong evidence carries a fingerprint of each image, calculated at the moment of capture. Whoever receives the document can check later that the image is the same one. That does not stop anyone from replacing an image — it stops them from replacing it **invisibly**, which is what matters.

## Why none of this hurts today

Here is why this subject is so hard to sell and so easy to understand afterwards.

**All four losses are deferred.** None of them bothers anyone on the day the screenshot is pasted. All of them bother someone months later, in a different quarter, usually with a different person involved — the auditor, the client, the new manager, the team that took over support.

In other words: whoever pays the cost is not whoever creates it. That is why the person executing finds it easy, and is being honest. And it is why the way a team records evidence rarely improves on its own: the person who feels the gap was not in the room when the method was chosen.

## Where a screenshot is enough

It does not always matter, and pretending otherwise would be dishonest.

- **Everyday internal communication.** Sending a screen to a colleague in chat. Nobody will audit that.
- **Bug reports.** The developer needs the screen and the message; the rest is in the ticket.
- **Automated tests.** The runner already records everything with timestamps and captures on failure. A manual screenshot there would be a step backwards.
- **Processes nobody will revisit.** There are plenty, and that is fine.

This article is about the cases where evidence **comes back**: user acceptance, client sign-off, internal audit, certification, contract disputes, and supporting a system someone else will maintain.

## What you can do without changing tools

If your screenshot process works and you would rather not touch it, three of the four gaps can be closed with habit, at almost no cost:

- **Keep a clock visible on screen** while you execute. It fixes the time, and it lives inside the image rather than outside it.
- **Keep the environment visible** too: the system name, the colored bar, the header. One screenshot at the start showing where you are goes a long way.
- **Name files with case and step**, always in the same format. Evidence that can be found is evidence that exists.
- **Capture the error too**, not just the success. That is the hardest habit and the most valuable one.

The fourth gap — integrity — cannot be closed with discipline. Either the tool calculates it, or it does not exist.

## Where Walkstamp fits

Walkstamp closes all four at once, by a different route: instead of you photographing what seemed important, it **records the execution** and then isolates the moments when the screen changed.

Each moment comes out with clock time, with the environment you declared (DEV, QA, PRD or sandbox), in the order it happened — including the error that showed up along the way, because that is a screen change like any other — and with a fingerprint of each image that anyone can check later on the [verification page](/en/verificar). Output is PDF, Word, HTML or Markdown.

And the video never leaves your machine. There is no server receiving anything: the whole process runs in your browser, and you can confirm that with DevTools open on the Network tab while a large file is processed. It is all written out in [Security](/en/seguranca), including what the tool does not do.

It is free, needs no account, and you can [open it now](/en) with any recording you have.

If you already have something that works, you do not need to switch. It is worth checking whether it answers the four questions — because the person asking them will not be around for you to explain what you meant.