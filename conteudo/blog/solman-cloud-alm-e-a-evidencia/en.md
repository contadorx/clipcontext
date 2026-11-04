SAP Solution Manager **goes out of support at the end of 2027**, and SAP itself recommends starting the move to SAP Cloud ALM now and completing it before 2028. It is written in [knowledge base article 3585220](https://userapps.support.sap.com/sap/support/knowledge/en/3585220).

So anyone running tests inside Solution Manager today has roughly a year and a half to decide what to do.

The debate I see everywhere is "does Cloud ALM already replace Solution Manager?". Fair question, badly framed, because it treats both as the same category of thing. And there is a third question almost nobody is asking — the one that will hurt in 2028.

First things first.

## What Solution Manager did for testing

Worth recapping, because plenty of people who work with SAP never used the [Test Suite](https://support.sap.com/en/alm/solution-manager/expert-portal/test-suite.html) — they used Solution Manager only for process documentation or change control.

The Test Suite bundled four things in one box:

- **Test plans and packages**, scoped from the solution documentation itself: which processes, which transactions, who executes what.
- **Test Steps Designer**, to write the manual script step by step inside the tool.
- **CBTA**, the built-in automation engine that recorded and replayed execution.
- **Change impact analysis (BPCA)**, backed by TBOMs: after a transport, it pointed to the processes and tests affected — answering the expensive question in any regression, which is *what has to be tested again*.

The point that matters here: **it was an integrated package.** Orchestration and execution lived in the same place.

## What Cloud ALM does better

Quite a lot, and this is not vendor talk.

It is built around the **process → requirement → test case → defect** chain, with end-to-end traceability and none of the manual assembly Solution Manager required. The [Test Management documentation](https://support.sap.com/en/alm/sap-cloud-alm/implementation/sap-cloud-alm-implementation-expert-portal/testmanagement.html) describes the full flow: preparing cases, building plans, distributing by tester and period, executing with pass/fail per action, and logging defects in the same place. You can even [upload cases in bulk from a spreadsheet](https://community.sap.com/t5/technology-blog-posts-by-sap/mastering-test-preparation-in-sap-cloud-alm-a-step-by-step-guide-to-bulk/ba-p/14289479), the kind of detail that decides adoption on a large project.

And it is web, it is fast, and it does not require a whole ABAP stack underneath. For anyone who suffered with Solution Manager, that is not a detail — it is half the argument.

So yes: **as a test orchestrator, Cloud ALM is better.** That part of the answer is simple.

## Where it is not a superset

The part that is not simple: Cloud ALM is not Solution Manager with a new interface. It is a different architecture, and it **delegates** what Solution Manager integrated.

- **CBTA does not come along.** The built-in automation engine belonged to Solution Manager and ends with it. In Cloud ALM, automation comes from outside — the Tricentis edition SAP distributes, the SAP Test Automation Tool, or whatever you already own. [A market gap analysis](https://blog.perfectwin.ai/sap-cloud-alm-test-management-strengths-gaps-automation-criteria) sums the shift up well: Cloud ALM orchestrates and reports, but delegates automated execution to external tools.
- **The bundled Tricentis edition covers web applications**, such as Fiori. SAP GUI and complex end-to-end scenarios usually require the full license. Confirm the scope with your account before putting it in the plan — this point comes from third-party analysis, not SAP documentation.
- **Test data preparation is not its job.** That remains your problem, solved elsewhere.
- **TBOM-based impact analysis, BPCA style, is a Solution Manager capability.** Before assuming there is a ready equivalent on the other side, check its current state — it is the kind of feature that decides the size of a regression, and nobody wants to discover it is missing at the last minute.

None of this is an accusation. It is the difference between an integrated product and an orchestrating one. **Cloud ALM is a much better conductor; it just does not play the instruments.**

For the comparison from SAP's own angle, [this piece from the product team](https://community.sap.com/t5/technology-blog-posts-by-sap/test-management-sap-cloud-alm-or-sap-solution-manager/ba-p/13525698) discusses when to use each.

## The third question: who produces the proof?

Now the part almost nobody is discussing, and it is independent of which of the two you pick.

In both worlds, manual testing works like this: someone executes the scenario in the system, comes back to the tool and states **what happened**. Marks passed or failed, writes a comment, and — if the project asks for it — attaches a file. It is exactly the flow SAP describes in its material on [managing manual tests in Cloud ALM](https://community.sap.com/t5/technology-blog-posts-by-sap/managing-manual-tests-with-sap-cloud-alm/ba-p/13573163).

Notice the verb. The tool **records the result.** It does not record the execution.

The attached file is still produced by hand, the same way as always: someone screenshots what seemed important, pastes it into a document, writes a caption and uploads it. And that file carries the same four gaps as always:

- **no clock time** per step, only the date someone saved it;
- **no environment** — and a QA screen looks identical to a production one;
- **no sequence**, especially the error that appeared mid-way and was worked around, because nobody photographs the problem they already solved;
- **no verifiable integrity**: no way to show that the image is the one that was captured.

I wrote about those four gaps in [What a screenshot loses](/en/blog/what-a-screenshot-loses), and they are why migrating tools touches none of them. You change where the status is recorded, and keep the same pile of screenshots as proof.

**Status says it passed. Evidence says how it passed.** Both are necessary, and only one of them is on either product's roadmap.

## And the history — where does that go?

This is the practical 2027 question, and it is worth a full meeting on your project.

If your company has run SAP for ten years, there is an archive of test results inside Solution Manager: regression cycles, sign-offs, evidence of changes that went through audit. Some of it has a contractual or regulatory retention period.

When Solution Manager goes out of support, that archive does not migrate on its own — and its format is a Solution Manager format. Decide now, calmly, three things: **what has to be preserved, for how long, and in what format an outsider will still be able to open it in five years.**

The good answer is almost always the same: a self-contained document, readable without the tool that produced it. A PDF with the time, the environment and the sequence inside. Not because it is elegant — because it is the only format that survives the next migration, and there will be one.

## Where this reasoning does not apply

- **If your testing is automated**, the runner already produces logs with timestamps, results and captures on failure. Evidence is born good there; the problem is retention and readability, not production.
- **If you use Solution Manager only for process documentation or change control**, the Test Suite was never your problem and this discussion does not change your plan.
- **If your industry has formal format requirements** — signature, specific retention, certified audit trail — no tool grants compliance by itself. It produces input; compliance belongs to the process.

## What I would do

- **Separate the two decisions.** "Which tool orchestrates testing" and "how evidence is produced" are different questions with independent answers. Mixing them is how this subject usually stalls.
- **Choose the orchestrator by what you actually use.** If your use of the Test Suite is plans, manual execution and defects, Cloud ALM covers it comfortably. If you depend on CBTA and impact analysis, the plan has to name a replacement for each — and that is a project, not a configuration.
- **Treat evidence as an artifact independent of the tool.** It has to be readable without the system that produced it, today and in five years.
- **Decide the fate of the archive before 2027**, not in the last quarter. Done in a hurry, that decision tends to become "delete".

## Where Walkstamp fits

Walkstamp handles the part neither of them handles: **producing the proof while the test happens.**

The tester records the screen and executes the scenario as usual, narrating along the way. The tool isolates the moments when the screen changed — including the error message that appeared mid-way — builds a document with clock time per step, the declared environment (DEV, QA, PRD or sandbox) and the spoken audio paired with each segment, and calculates a fingerprint of every image that anyone can check later on the [verification page](/en/verificar). Output is PDF, Word, HTML or Markdown, with ready-made links for attaching in Zephyr, Jira and TestRail, where results usually live.

It does not replace Cloud ALM or Solution Manager, and does not try to: it does not plan tests, manage defects or automate anything. It produces the attachment — and the attachment is the one part the migration will not improve on its own.

And the video never leaves your machine: the whole process runs in the browser, with no server in the path, which tends to settle the conversation with information security before it starts. It is all written out in [Security](/en/seguranca), including what the tool does not do. It is free, needs no account, and you can [open it now](/en) with any recording you have.