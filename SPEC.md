## Goal
I want to build a single-page chat bot web application powered by an LLM API which builds a travel profile for the user based on their preferences gathered through natural conversation.
The application needs to gather information conversationally by asking relevant questions to understand the user in order to build out the profile. An initial version of the profile spec will be included later in this document.
It will need to be able to identify constraints and handle conflicts or ambiguous user inputs. Handle ambiguity by asking follow up clarifying questions.
The profile needs to be stored in a DB so it survives app reloads.
The agent must call the function getDestinationInfo which will provide information about a given destination. This function needs to hardcode data about 5 randomly selected desitionations of your choosing. The spec for this function will also be defined later in this document.
Given that getDestinationInfo is limited to 5 hard coded locations the agent will have to handle null responses from this function.
The user should be able to add, update or remove information from their profile. The profile will be visible in the UI and updated in real time.
The current profile should be used to guide future questions.
The chat must stream the LLM responses.
The LLM should only respond to travel profile related questions and deflect user inputs to take it beyond it's intended scope.
The agent should try to ask as few questions as needed to build a complete profile. The user experience should be more like an interview than an interrogation.

## Scope
Any use of 3rd party libraries other than the ones explicitly mentioned in this document need to be approved by me. Avoid using any extra ones if possible.
Once an agreed upon mock is chosen develop a Tailwind theme which defines the minimal CSS tokens needed to style the app according to the mock. Dark mode theme is out of scope to start with, but may be something to add if time allows.
Authentication is out of scope. Assume only one user.
There will be no other features other than the core chat and profile view.
Test coverage should be limited to critical areas and edge cases. Full coverage is out of scope.
The time limit for completion of this app is two hours.
The app should only have one route.
We should have a set of primitive UI components from which the main application is built. UI components should be well designed and abstracted. Hooks should be used for reusable logic or business rules.
I'd like to discuss if the user profile fields should have weights associated with them or some kind of 'must-have' flag. This weighs on the complexity of the app and could impact time which is limited.
The LLM should be thoughtful about visa requirements given the user's passport(s).
Include a README which contains instructions on how to setup and run the app. A user must be able to get it up and running within 5 minutes.
Users running this app locally will need to provide their own API key. Keys should be located in .env files and not committed. Commit a .env.example though. The README should include instructions for obtaining the .env file values.

## Tech Stack
React, TypeScript, Next.js, Zod, Tailwind CSS, SQLite library of your choosing, plus something to connect to a free LLM model (preferrably gemini or another mainstream model) and a testing library. The model of choice should be discussed more.
SSE plus POST for client to server calls. If global state management is needed we can add a library for that as well, but it needs to be discussed first.


## Critical Data Structures

These should be considered starting points and need critical analysis.

```typescript
interface UserProfile {
  user: {
    dietaryPreferencesAndRestrictions: string[]; // e.g. Vegetarian, no seafood...
    specialNeeds: string[]; // Accomodations for disabled or special needs users.
    location: string; // Where the user is located. This may need to be more complex. Let's review this.
    passports: string[];
  };
  // Params that describe high level preferences. Should not be specific things about one particular trip.
  preferences: {
    travelStyle: Array<'solo' | 'family' | 'friends' | 'partner'>; // This is just a start for options. If you can think of more expand on this.
    avoid: string[]; // Things the user explicity doesn't like.
    budgetTier: Array<'budget' | 'mid-range' | 'luxury'>;
    interests: string[]; // e.g. art, history, food, hiking, scuba diving,...
    targetSeasons: Array<'spring' | 'summer' | 'fall' | 'winter'>;
    pace: string[]; // We should use string literals here I think, but need your help defining the vocabulary to capture the full range of options. I'm open to keeping it a string though. I'm also open to dropping this field.
  };
  // These next two params need improvement. The goal is to have fields which collect where the user has been and places that the user has identified that they like and dislike. Maybe include things they did on past trips too? This could help the agent identify preferences.
  destinations: {
    dislike: boolean;
    location: string;
    season?: Array<'spring' | 'summer' | 'fall' | 'winter'>;
  };
  travelHistory: {
    dislike?: boolean;
    location: string;
    season?: Array<'spring' | 'summer' | 'fall' | 'winter'>;
  }[];
}

// Response structure for getDestinationInfo when it returns a non-null response.
interface DestinationInfo {
  name: string;
  bestSeasons: Array<'spring' | 'summer' | 'fall' | 'winter'>;
  knownFor: string[]; // e.g., ["food", "architecture", "hiking"]
  averageDailyBudgetUSD: { budget: number; midRange: number; luxury: number };
  visaNotes?: string;
  cuisine: string[];
}
```

## Areas to Discuss

Before any coding happens we need to discuss the following issues before finalizing a plan.
- Full lifecyle of an API call.
- How contradictions, conflicts, or ambiguous inputs will be handled by the agent.
- Structure of UserProfile and DestinationInfo. DestinationInfo needs be to suffient to complete the UserProfile.
- LLM model to use.
- Tech stack.
- Mocks - don't build until requested.
