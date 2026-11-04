Open your project's test case spreadsheet and look at any row. It probably says something like *"create sales order"*, with four steps underneath and an expected result ending in *"the order must be created correctly"*.

Now follow the person who has to execute it.

They will spend the first three hours of the day hunting for a material with a valid price, a customer with credit released, stock in the right plant and an open period. When they finally get there, they will run the test in eight minutes. And mark it as passed.

**Those three hours were not in the plan. And they are what decides whether the test is worth anything.**

## A script is an instruction. A scenario is a condition.

A script says what to click. A scenario says **in what situation the rule should hold**.

"Create sales order" is an instruction. The scenario is something else:

> *Customer with a partial credit block, material subject to tax substitution, delivery to another state, quantity above the minimum lot, open period. The order must be created with a delivery block and without its own tax calculation.*

Notice what appeared: **an initial state, a specific combination, and a result you can actually check.** That is what makes a test a test — rather than a guided tour of the transaction.

When a case is written as a script, the condition does not disappear: it is silently transferred to whoever executes. That is why they spend three hours building test data. They are not wasting time; **they are writing the missing scenario, without credit for it, and without leaving a record.**

## The five parts of a scenario that holds up

- **Precondition** — the state of the world before: which master data, with which characteristics, in what situation.
- **Input** — what will be entered, with concrete values, not "fill in the mandatory fields".
- **Action** — where and how it is executed.
- **The rule under test** — the reason the scenario exists. Without it, nobody knows what to do when the result is ambiguous.
- **Verifiable expected result** — a document, a status, a value, a specific message. Never "correctly".

Miss the first and you have a scavenger hunt. Miss the last and you have an opinion.

## Why test data is the most expensive problem

Test data is the part of the scenario nobody writes, and it misbehaves in four different ways.

**It burns.** Many scenarios run only once: the order becomes a delivery, the batch is consumed, the status moves forward and does not come back. Re-running means building everything again — so in regression, almost nobody re-runs. People check what they can, and the rest is trust.

**It ages.** The scenario passes today and fails in two weeks because the contract expired, the price lapsed, the period closed. The defect reported is not the system's: it is the calendar's. And it consumes a full analysis cycle before anyone notices.

**It is shared.** Two people using the same customer in the same environment produce different results. The lazy conclusion is "the environment is unstable". The correct one is that the precondition was under nobody's control.

**It is not written down.** And this one closes the argument: **if the test data is not recorded, the scenario is not re-executable.** Not by someone else, not in another environment, not six months later. A scenario only one person can run is not a project asset — it is knowledge in the head of someone who will eventually take a holiday.

## The dependencies nobody mapped

There is a second-order effect that tends to blow up mid-cycle: **scenarios that depend on each other.**

Scenario 12 needs the document scenario 7 creates. Scenario 20 needs the stock scenario 15 moves. When 7 fails, five scenarios are blocked — and that appears nowhere until the day the dashboard shows 40% execution and nobody understands why.

It is worth spending an hour at the start marking which cases are **independent** and which **depend on another**. That is the information that lets you replan the cycle instead of discovering the blockage on a Friday.

## Coverage that looks bigger than it is

Projects with many scenarios tend to carry a sense of safety the content does not support. Seven hundred and eighty cases sound like a lot — until you ask how many of them test an **exception**.

The happy path is easy to write and easy to pass. What breaks in production is almost always the other kind: a customer with incomplete master data, an item with a special rule, a partial return, an interstate operation, a user with a restricted profile.

A quick and revealing check: take twenty cases at random and count how many have anything non-standard in their precondition. If the answer is two or three, your coverage is wide, not deep.

## Where this reasoning does not apply

- **Smoke tests** — the "open it, log in, save" after a transport — are meant to be shallow. Do not write scenarios for that.
- **Automated tests** usually create their own data in setup and destroy it in teardown. There the problem stops being describing the precondition and becomes maintaining it in code.
- **A small project, one system, little tax complexity**, does fine with a simple spreadsheet. Do not invent ceremony where there is no complexity.
- **And a perfect scenario on paper does not replace people who know the process.** The best scenario in the world, written by someone who never operated it, will test what the design assumed, not what the operation does.

## What I would change in your spreadsheet this week

- **A precondition column**, mandatory, with named master data. Not "any customer": *customer with a partial credit block*.
- **Expected result with an object**: document number, status, value, message. If it cannot be checked without a debate, it is not yet an expected result.
- **A re-execution flag**: is this scenario **repeatable** or does it **burn the data**? That alone reorganizes regression planning.
- **A dependency column**: which case does it depend on?
- **A reference data set**, created and documented once, with names reserved for testing — and a rule that nobody else touches it.
- **And a record of which data was used in each execution.** That is the difference between "scenario 47 passed" and "scenario 47 passed with material X, customer Y, on date Z, in the QA environment".

## Where Walkstamp fits

Walkstamp does not build test data and does not write scenarios — that is the work of people who know the process. It solves the last item on the list above: **recording, with no extra work, the conditions the execution actually ran under.**

The person records the screen while executing and narrates what they are doing. The tool isolates the moments when the screen changes and builds a document with clock time per step, the declared environment, and the speech paired with each segment. The master data used appears on the screens, in the order it was entered — and that is what makes the scenario re-executable by someone else, months later.

In practice, the execution document becomes the precondition nobody wrote. Not because someone stopped to document it, but because it was recorded while it happened.

Output is PDF, Word, HTML or Markdown, and the video never leaves your machine — the whole process runs in the browser. It is all on the [Security page](/en/seguranca). It is free and needs no account: you can [open it now](/en).

I wrote earlier about [the defect nobody can reproduce](/en/blog/the-defect-nobody-can-reproduce), which is the same problem one step further along: when you do not know the conditions a test ran under, you cannot repeat either the success or the failure.

One question for your next cycle meeting: **if the person who executed scenario 47 goes on holiday tomorrow, can anyone run 47 again?** The honest answer usually says more about test maturity than any coverage dashboard.