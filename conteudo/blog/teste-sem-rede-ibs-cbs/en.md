*Written on 20 August 2026. The core of this article holds while the IBS and CBS validation rules remain postponed — and no end date has been published.*

The billing team celebrated: the invoice went out, authorized, without the new tax block filled in properly. Nothing blocked, the order shipped, the week moved on.

The reason for the relief is Joint Technical Act CGIBS/RFB No. 1, dated 31 July 2026, which postponed the validation rules for the IBS and CBS fields in electronic tax documents. In practice: documents are not rejected when those fields are missing. It covers NF-e, NFC-e, CT-e, CT-e OS, GTV-e, BP-e, NF3e and NFCom.

Note what was postponed, because most coverage gets this wrong: **the rejection fell away, not the fields.** The obligation to report remains, and the schedule still stands. The document is authorized incomplete, and whoever did not fill it in is failing an obligation — not enjoying an exemption.

But the side effect is bigger than the debate about the obligation, and it is about testing.

For the legacy taxes, the authorities still filter. An invoice with the wrong ICMS gets blocked, and that block has worked for two decades as a free external checker: if it cleared, some minimum coherence existed. For IBS and CBS there is no filter at all. The one due in August was postponed before it ever applied.

Anyone testing the dual VAT is testing without a safety net. And most have not noticed, because invoices keep being authorized.

## Filled in is not the same as correct

One number has circulated widely: on 4 August 2026, roughly 88% of the required documents already had the IBS and CBS fields filled in.

It is a good number, and it measures exactly one thing: **completion rate.** It says nothing about accuracy.

And there is the problem: nobody publishes an accuracy rate, because nobody can measure it. The authorizing environment does not check the value — it receives it. A field filled with the wrong rate, the wrong base, the wrong tax code or a missing exception lands in the same statistic as a perfect one.

Worse, the data moves on. It feeds ancillary obligations, cross-checks and history. The error nobody blocked at the door does not sit still waiting to be found; it becomes a baseline for comparison.

There is a wide gap between "88% of companies adapted" and "88% of documents are correct", and the first sentence is being read as the second in a lot of status meetings. It is the kind of number that reassures a board and protects nobody.

## An ERP screen does not prove a tax calculation

Here I have to agree with an objection I heard from a tax quality professional, and it is correct:

*"A screenshot of the order or invoice screen does not prove tax compliance. What the auditor wants is the authorized XML, the calculation trail and the middleware log matching the rule. The hard work is in the messaging layer, not the front end."*

That is right, and worth saying plainly: **no screen capture demonstrates that a tax rate was calculated correctly.** Anyone promising that is selling something.

Proof of the calculation is the file: the authorized XML, with its values, checked against the rule that should have applied to that transaction. Screen tooling has no part in that conversation, and no tool grants compliance.

But there is a second thing being proven in a test cycle, and it is routinely confused with the first.

## What execution proves, and the calculation does not

The XML proves what the system calculated. It does not prove **what the system was asked to do.**

And that is exactly where today's errors are born. The problems showing up now rarely come from the tax engine: they come from stale master data, from an exception that was not parameterized, from a special regime that was not applied, from a material with the wrong classification. They start at the input — in what the operator picked, typed and confirmed before any calculation happened.

Three months later, when someone pulls up an XML with an odd value, the question that stalls the discussion is not "what did the system calculate". It is:

- which material, which customer, which condition was this scenario run with?
- which environment did it run in?
- did the screen show a warning, and did the person proceed anyway?
- was it the exception scenario from the script, or did someone test the happy path and mark it approved?

None of those are in the XML. All of them are in the execution — and execution, today, is recorded nowhere. It becomes the memory of whoever was there, and whoever was there has already left the project.

**These are proofs of two different things: the file proves the calculation; the execution record proves that someone ran the intended scenario and looked.** Missing either one, the evidence is incomplete.

## Where this does not apply

- **If the test is automated**, the runner already logs input, output, time and failure. Evidence is born complete there, and recording a screen would be rework.
- **If what you need to validate is the calculation itself** — rate, base, tax code, exception — the path is comparing XML and calculation trail against the rule. Screens do not help, and insisting on them wastes time.
- **If the scenario is integration** — messaging responses, assisted assessment, contingency — the object of the test is the other side's answer, not the interface journey.
- **Bulk schema validation** is not a manual execution matter either.

This article is about the middle: acceptance testing run by business people, exception scenarios, sign-off with key users. That is where most of the volume of this reform sits, and nearly every argument that erupts later.

## The acceptance criterion that changes this week

If the last step of your test script is "invoice authorized", it stopped meaning anything on 31 July. Three changes you can make to the script with no project at all:

- **Change the final criterion.** From "document authorized" to "value checked against the rule". Authorization became a prerequisite for transmission, not evidence of correctness.
- **Require the full package per approved scenario:** the authorized XML, the calculation trail checked against the applicable rule, and the execution record showing what data it was run with. All three, or the proof is half done.
- **Log the debt.** Every scenario approved since August using "it cleared" as the criterion is a candidate for re-execution. With no published end date for the postponement, that queue can grow for months — and it will be called in all at once, at the worst possible moment, when rejection is switched back on.

The third one is the most uncomfortable and the cheapest to start now: one extra column in the case spreadsheet, with the date the scenario was approved and the criterion used.

## Where Walkstamp fits

Walkstamp handles the third part of the package — the execution record — and does not attempt the other two.

The tester records the screen and runs the scenario as usual, narrating. The tool isolates the moments when the screen changes, including the warnings and errors that appear along the way, and builds a document with clock time per step, the declared environment (DEV, QA, PRD or sandbox) and the spoken audio paired with each segment. Output is PDF, Word, HTML or Markdown, with ready-made links for attaching in Zephyr, Jira and TestRail — next to the XML, which remains the proof of the calculation.

Two things it does **not** do, and nobody should promise: it does not check tax rates, does not validate calculations, and does not grant compliance to anything. It does not replace comparing the XML with the rule, which remains the work of people who understand tax.

The video never leaves your machine — the whole process runs in the browser, with no server in the path, which tends to end the conversation with information security before it starts. It is all in [Security](/en/seguranca), including what the tool does not do. It is free and needs no account: you can [open it now](/en) with any recording you have.

And if you are testing billing in this window, the question I would leave on the table at the next project meeting is simple: **how many of the scenarios approved in the last month were approved because the invoice cleared?**