# Project Overview

Top G Sportsbook is a betting layer on top of a 10-team home fantasy football league that runs on ESPN Fantasy. Two league members, Kyle Kleon and Will Shaw, run it today. They set weekly lines, take bets, and settle up at the end of the week.

Goal: replace the current manual flow (AI-made graphics plus Snapchat messages) with a simple web app where:

- Admins (Kyle and Will) post weekly lines and settle bets.
- League members browse lines, place bets, and see their active and past bets.
- League data (matchups, projections, scores, standings) comes in automatically from ESPN where possible.

What the app does NOT do:

- It does not move money. Payments stay on Venmo, outside the app. The app is only a ledger of who bet what and who owes whom.
- It does not set the official lines. Kyle and Will set lines. The app can suggest lines, which admins accept, edit, or ignore.

Scale: 10 league members, usually 5 to 8 of them betting each week. Data volume is tiny, so keep the setup simple and avoid heavy infrastructure.
