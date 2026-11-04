There is one question that ends any project discussion: **"show me the evidence for case 47."**

It is not a technical question. It is a question about organizational memory, and most projects answer it worse than they think. The case is there, marked as approved, with the name of whoever ran it. The evidence is a document with four screenshots and one sentence under each. None of the screenshots has a timestamp. None says which environment it came from. And the step where an error appeared and was worked around is missing — because when the document was assembled, it did not seem important.

That is not a team failure. It is the predictable result of a design where evidence is produced after execution, by someone in a hurry to close the cycle.

## The six questions evidence has to answer

Before discussing tools, it helps to be clear about what you are trying to produce. Useful evidence answers six things without depending on anyone's memory:

- **What** — which case, which requirement, which version of the script
- **Where** — which environment, which system, which client
- **Who** — who executed it, and who reviewed it
- **When** — the clock time of each step, not the file date
- **How** — the full sequence, including what failed and how it was worked around
- **What appeared** — the screen as it was, not a description of it

A screenshot pasted into a document usually answers two of them: what, and what appeared. The other four are left to whoever remembers.

## The problem is not the team. It is the timing.

None of those six questions is hard to answer **during** execution. The person running the test knows the environment, knows the time, saw the error appear and knows what they did next.

All six get hard **afterwards**. And afterwards is exactly when the document tends to be assembled: at the end of the cycle, under deadline, by someone reconstructing from memory what they did three days ago.

Something I learned working with Six Sigma and never unlearned: **a control that depends on voluntary effort at the end of a process has already failed on paper.** Not because people are careless — because the process asked for discipline on the one day nobody has any to spare.

Evidence reconstructed later is not evidence. It is someone's recollection, with pictures attached.

## The cost nobody counts

It shows up in two places, and neither one is in the project budget.

The first is assembly. Add up the time a tester spends cropping screenshots, pasting, writing captions and saving files. Multiply by the number of cases, then by the number of regression cycles. In a run of 40 cases across three cycles, even five minutes per case turns into ten hours of work that tested nothing.

The second is rework: the evidence someone asks for three months later and nobody can find; the discrepancy found in a database check that became an argument from memory because nobody saved the query result; the case that has to be executed again because the proof did not survive.

The second cost is bigger than the first, and invisible — it lands in a different quarter from the one that created it.

## Where this reasoning does not apply

Worth saying plainly, because not every test has this problem:

- **Automated tests already produce better evidence.** The runner logs everything with timestamps and captures on failure. The problem there is retention and readability, not production.
- **Processes with sensitive data need redaction before anything circulates.** Recording a screen full of personal data and distributing the document trades one problem for a larger one.
- **Regulated audits usually have their own format,** with specific requirements for signature, retention and trail. No tool grants compliance — the process does.

This article is about the middle: manual testing, user acceptance, post-integration validation and work instructions. That is where most of the volume and nearly all of the pain live.

## How to invert the order, in practice

![Atenção ao Teste](/img/blog/evidencia-que-o-auditor-aceita/1787069528888.jpg)

This is not a project. It is five small decisions:

- **Record the execution instead of photographing it.** Moving screen captures the whole sequence, including what went wrong — the part screenshots always lose.
- **Narrate while you execute.** Saying out loud "now I'll post this without the cost center to see the message" turns a recording into an explained document, at zero extra cost.
- **Show the environment on screen** at the start. It answers "where" with no extra work.
- **Store the artifact with the case**, not in a parallel folder. Evidence that lives far from the case is evidence nobody finds.
- **Discard the raw video once the document exists.** The document answers the six questions; the recording just takes up space and nobody watches it again.

None of the five asks for discipline afterwards. All of them happen during — and that is the only difference that matters.

## Where Walkstamp fits

Walkstamp exists for the middle step: turning the recording into a document without manual work.

You record your screen, or use a recording you already have. The tool finds the moments when the screen actually **changes** — the click that opened the window, the error message, the record that was saved — and builds a document from those moments, with the time of each one and the spoken audio transcribed and paired with the matching segment. Output is PDF, Word, HTML or Markdown. A two-gigabyte recording becomes a file of a few megabytes that answers all six questions, and the recording can be deleted.

The detail that usually decides the matter inside a company: **none of this leaves your computer.** There is no server receiving the video — the whole process runs in your browser. You can verify it with DevTools open, on the Network tab, while it processes a large file: the sent column stays at zero. It is all written out in [Security](/en/seguranca), including the certifications the tool does **not** have, and why.

It is free, requires no account, and you can [open it now](/en) with any recording you have lying around.

And if something breaks while you try it, tell me. At this stage, a reported bug is worth more than a compliment.