# Process

## Transcripts

Claude transcripts are available in the `conversations.json` file or the share link https://claude.ai/share/b1eaeca5-6b57-4c4e-a877-0ec54974fcab. The JSON file also contains a separate session, "GitHub push rejected error", where I debugged errors I was getting when pushing to GitHub. Something was wrong on the GitHub side of things and I eventually had to recreate the repo. Since it was likely a bug on GitHub's side I'm not including a share link for that.

## Annotated highlights

Numbers like `#20` refer to message positions in the "Profile builder app planning" session in `conversations.json`.

**1. Plan first, and make it argue with me (#2, #4)**
Because of the time limit, I kept the starting profile in SPEC.md deliberately small. I stuck to the obvious things that shape a trip (diet, accessibility, passports, who's traveling, budget, interests, timing, places they've been) rather than trying to model everything up front. I left a few open "let's discuss" spots and asked for an adversarial review before any code. It found real problems: seasons flip between hemispheres, so a "summer" Cape Town trip would match wrong. `[]` couldn't tell "never asked" apart from "none". And I'd never defined what a complete profile was. I switched to months, used `null` vs `[]` for asked/not asked, and agreed on a list of nine essential fields that make a profile complete.

**2. Don't confirm inferences, just save them (#4, #6)**
It recommended confirming every inference ("you loved Kyoto, so temples?") before saving. I didn't want an extra round trip every time, so I went the other way. Inferences save immediately with an "inferred" tag, and you can ✕ any item in the UI, inferred or not. Rejections are remembered so it won't re-infer them. Hard constraints like diet, accessibility and passports are never inferred.

**3. Cutting fields to fit two hours (#4, #6)**
It suggested six more profile fields. I kept `tripLength` and accommodation as optional and cut the other four (languages, kids' ages, adventure level, long-haul tolerance). I also dropped the weights idea from my own spec. Priority comes from where a field lives instead: `traveler` fields are hard constraints, and everything else is a preference. Time was tight, and I couldn't promise I'd have time to test the extra fields properly.

**4. Two challenges to the destination schema, one win each (#20, #22)**
I asked whether `pace` belonged on DestinationInfo, since you can do any destination at any pace. It agreed and removed it. Then I tried to cut `dietaryNotes`, figuring it could be inferred from cuisine, and it pushed back with a good example: Kyoto's cuisine list includes temple vegetarian food, but fish stock shows up in lots of everyday dishes, so the cuisine list alone would mislead the agent. Diet is a hard constraint, so I didn't want the model guessing there. I kept it.

**5. Reviewing in stages, until I ran short on time (#16, #26)**
I had it work in stages so I could review each one before committing. That's why the schema, destination and database commits are small. Near the end I told it to finish everything at once, so the agent loop, routes and UI all landed in one big commit. I read the schema line by line. The reducer, database layer, agent loop and UI I mostly skimmed and checked by running the app, and the commit size shows it.

**6. The first message failed, and it fixed a guess (#28–#36)**
My first chat message errored out. It couldn't reach Gemini or see my terminal, so it guessed the auto-generated tool schema was the problem. It rewrote the schema by hand and added retries and dev-mode error details. Those details showed "high demand" errors from the free model, so I had it switch the default model and add a fallback chain. I never pinned down what caused the very first failure. The schema rewrite was a guess I never confirmed as the fix, but I kept it because it's a better design anyway. The flat schema avoids the nested unions, nullable types and huge number limits that Gemini's function calling handles badly. Its value lists come from the same constants as the Zod schema, and a test checks the flat shape converts back into valid ops. Testing it also turned up a real bug: one malformed change from the model was failing the whole batch. Now the valid changes still apply, and the bad one goes back to the model as an error.

**7. Stop letting the model describe its own changes (#42)**
I said "mid-range with some luxury" and the reply showed "- Budget tier: mid-range". That read like a removal of something I'd never set, and nothing had actually been saved. The model was writing change lines that didn't match what it did. So the server now diffs the profile before and after each turn and shows the changes itself. Budget also became a list. That undid a decision from planning, but when I actually used it I wanted more than one tier.

**8. Testing ambiguity myself (#46, #48)**
I mentioned Columbus to see if it would ask which one. It didn't, because nothing in the prompt told it to. It offered a quick prompt rule or a tool-level "ambiguous" result, which would have needed a sixth destination. I took the prompt rule. It works most of the time but isn't guaranteed, so I count it as a known gap.

**9. Adding "Start over" anyway (#32)**
My spec said no extra features, but I couldn't test conflict and ambiguity cases without wiping the profile quickly. So I added a reset button with a confirm step. It broke on the first try ("Could not reset"). It got database fixes (a lock timeout and rolling back leftover transactions), but I never confirmed what caused it.

## Reflection

**Overall approach**
I planned first. I spent about 20 minutes writing SPEC.md, then went through the review, schema questions and mocks with the model before any code got written. I wanted the arguments about data shape to happen while they were cheap to change. I scoped the profile small on purpose before the review, so the planning time went into getting a few fields right rather than covering everything. After that I kept it on a short leash for the core logic. When time got tight I let it drive the agent loop and UI in one go. The end of the session was less controlled than the start and ended up relying on manual testing of the running app to confirm its functionality.

**What I reviewed vs. trusted**
I read the profile schema line by line, because a bug there quietly corrupts the profile. The reducer, the destination data and the database layer I skimmed due to time constraints. The agent loop, SSE route and UI components I mostly skimmed as well and tested by using the app. Conflict handling, ambiguity and off-topic deflection come from prompt rules. I saw them work in my own conversations, but there are no automated tests for them, and I wouldn't call them verified.

**What I'd do differently**
I'd get a real request through to the model much earlier. My first live message didn't happen until the whole app was built. That's where the overload errors and the budget reporting bug showed up. A five-minute "does a tool call work at all" check right after the scaffold would have caught the overload problem much sooner. I'd also get the real error before letting it rewrite code over a guessed cause. And I'd keep the staged commits going to the end instead of collapsing the last half into one. I also wish I had time to implement a better UI for handling conflicts or clarifying questions. Rather than relying on a round trip agent turn I would have preferred buttons and an optimistic update. I'd also lower the effort setting for Claude. I used Opus 5.5 on High effort which likely slowed things down and contributed to the time crunch.

**If this had to run at scale**
- **Model and provider:** a paid tier with a real rate limit, plus a fallback to a second provider, not just a second model.
- **Prompting and cost:** the system prompt and destination data barely change, so I'd cache them. I'd also send fewer old messages, since the profile already acts as the memory. That should cut tokens a lot. If we had concerns about long conversations I'd consider adding some kind of summarizer loop to keep the context small.
- **Schema:** profiles keyed by user in Postgres instead of one SQLite row, with proper migrations. The `schemaVersion` field is already there for that. I'd also consider making the profile and destination schema richer to have a higher quality profile.
- **Evals and benchmarks:** this is the part I'd build first. I'd write a set of scripted conversations covering the cases that matter: a contradiction, an ambiguous place, an unknown destination, a visa question for each passport, and a rejected inference. Each would be scored on the profile diff it produces, not on how the reply reads, and timed for latency. Running it on every prompt or model change gives us a baseline, so quality and speed can't drift the wrong way unnoticed as the team makes changes. The same suite is how I'd compare candidate models.
- **Observability:** structured logs per call (model, latency, tokens, tool calls), plus tracking how often tool calls fail validation in production, so a change in model behavior shows up as a number.
