export type LegalBlock = string | string[];

export interface LegalDoc {
  title: string;
  updated: string;
  intro: string;
  sections: { heading: string; blocks: LegalBlock[] }[];
}

/** Shown on both pages. Set NEXT_PUBLIC_CONTACT_EMAIL, or it falls back to the Trezor manifest email. */
export const CONTACT_EMAIL =
  process.env.NEXT_PUBLIC_CONTACT_EMAIL ||
  process.env.NEXT_PUBLIC_TREZOR_MANIFEST_EMAIL ||
  "";

const UPDATED = "16 November 2026";

export const TERMS: LegalDoc = {
  title: "Terms of Service",
  updated: UPDATED,
  intro:
    "These terms cover your use of Workbolt, a board where people post small jobs with a price in sats and freelancers take them on and get paid over Bitcoin's Lightning Network. By signing in, you agree to them. If you don't agree, please don't use Workbolt.",
  sections: [
    {
      heading: "What Workbolt is",
      blocks: [
        "Workbolt connects people who need a task done (posters) with people who can do it (freelancers). The agreement to do a task, and the payment for it, is between the poster and the freelancer. Workbolt is not a party to that agreement, does not employ freelancers, and does not guarantee that any task is done or paid for.",
        "Workbolt is an early project built for the Satoshi Sister Circle Sovereign Hack. Features may change, break or be removed.",
      ],
    },
    {
      heading: "Your account",
      blocks: [
        [
          "You must be at least 18 years old to use Workbolt.",
          "You sign in with a Google account. Keep one Workbolt account per person.",
          "Use your real name or a name people can recognise you by, and keep your payout details correct.",
          "You are responsible for what happens under your account.",
        ],
      ],
    },
    {
      heading: "Posting a task",
      blocks: [
        [
          "Describe the work honestly, with a fair price and a realistic deadline.",
          "Only post a task you can pay for. If you post it, you are expected to pay the agreed price when the work is delivered as described.",
          "You can't accept your own task.",
          "Anything you write on a task, including your contact details, is public. Anyone can see it, signed in or not.",
        ],
      ],
    },
    {
      heading: "Taking on a task",
      blocks: [
        [
          "Only accept work you can deliver by the deadline. If you can't, give the task back before you ask to be paid, so someone else can take it.",
          "Your payment request must be for exactly the agreed price.",
          "Deliver original work, or work you have the right to hand over.",
        ],
      ],
    },
    {
      heading: "Payments",
      blocks: [
        [
          "Prices are in sats (1 bitcoin is 100,000,000 sats). Any naira figure shown is an estimate only.",
          "Payments go directly from the poster's wallet to the freelancer's Lightning invoice or Flash wallet. Workbolt does not hold or move that money.",
          "Lightning payments are final. Workbolt can't reverse, refund or recover a payment, including one sent to the wrong invoice.",
          "A payment proof (preimage) shows that a specific invoice was paid. It does not show that the work was good.",
          "You are responsible for any taxes on what you earn or pay, and for any fees your wallet or Flash charges.",
        ],
      ],
    },
    {
      heading: "Commitment bond",
      blocks: [
        "When the bond is switched on, posting a task locks 20% of its price in a Lightning hold invoice. The sats are held in flight on the Lightning Network, not spendable by anyone, until one of these happens:",
        [
          "The poster proves they paid the freelancer (or Flash confirms it): the bond is cancelled and the sats go back to the poster.",
          "The freelancer asked to be paid and the poster didn't pay within the waiting time shown on the task: the freelancer can claim the bond, and Workbolt sends it to their Flash wallet or Lightning address.",
          "Nobody took the task before the hold invoice expired: it expires and the sats go back to the poster.",
        ],
        "The bond is a commitment signal, not insurance. It does not cover the full price, and it does not settle disagreements about the quality of work.",
      ],
    },
    {
      heading: "Trezor verification",
      blocks: [
        "A verified badge means the profile owner signed a statement with a key held on a Trezor device. It shows control of that key. It is not an identity check, and Workbolt does not vouch for anyone who has it.",
      ],
    },
    {
      heading: "What you must not do",
      blocks: [
        [
          "Post or take on anything illegal, harmful, hateful, sexual, or meant to deceive or defraud.",
          "Use more than one account to accept your own tasks or to game the commitment bond.",
          "Harass other users, or use their contact details for anything other than the task.",
          "Attack, overload, scrape or try to get around Workbolt's security or rules.",
        ],
      ],
    },
    {
      heading: "Disagreements between users",
      blocks: [
        "If a poster and a freelancer disagree about a task, they need to sort it out between themselves. Workbolt can remove tasks or accounts that break these terms, but it can't decide who is right or move money between users.",
      ],
    },
    {
      heading: "Ending your use",
      blocks: [
        "You can stop using Workbolt at any time, and ask us to delete your account (see the Privacy Policy). We may remove tasks or close accounts that break these terms or put other users at risk.",
      ],
    },
    {
      heading: "No warranty, and limits on liability",
      blocks: [
        "Workbolt is provided as it is, without any promise that it will work without errors or be available at all times. Payments run on third-party services (Lightning wallets, Flash, Google, Supabase) that we don't control.",
        "As far as the law allows, Workbolt and the people who build it are not liable for lost sats, lost earnings, or any indirect loss from using Workbolt, from tasks between users, or from those third-party services.",
      ],
    },
    {
      heading: "Changes and law",
      blocks: [
        "We may update these terms. When we do, we change the date at the top. Using Workbolt after a change means you accept the new terms.",
        "These terms are governed by the laws of the Federal Republic of Nigeria.",
      ],
    },
  ],
};

export const PRIVACY: LegalDoc = {
  title: "Privacy Policy",
  updated: UPDATED,
  intro:
    "This policy explains what Workbolt collects when you use it, what is public, who else sees your data, and how to have it deleted. Workbolt collects only what it needs to run the board.",
  sections: [
    {
      heading: "What we collect",
      blocks: [
        [
          "From Google when you sign in: your name, email address, profile picture link and Google account ID.",
          "From your profile: the name you show, your skills, your Flash username or wallet ID, and your Lightning address.",
          "From tasks: titles, descriptions, prices, deadlines, the contact details you enter, delivery notes and links, payment requests (invoices) and payment proofs.",
          "From Trezor verification, if you use it: a bitcoin address, the statement you signed and the signature.",
          "Technical data: your sign-in session is kept in your browser's local storage. Our hosting and database providers keep standard server logs, such as IP addresses and browser type.",
        ],
        "We don't use advertising or tracking cookies, and we don't sell your data.",
      ],
    },
    {
      heading: "What is public",
      blocks: [
        "Workbolt is a public board. Anyone, signed in or not, can see:",
        [
          "your profile: display name, skills, Flash username or wallet ID, Lightning address and Trezor address",
          "every task: its details, the contact details on it, who posted it, who took it, the payment request and the payment proof",
        ],
        "Your email address is not shown to other users. Only put contact details on a task that you are happy for anyone to see.",
      ],
    },
    {
      heading: "How we use it",
      blocks: [
        [
          "To sign you in and keep your account yours.",
          "To show the board and keep each task's status up to date.",
          "To check payment requests and payment proofs, and to create Flash invoices when you choose Flash.",
          "To run the commitment bond, when it is switched on.",
          "To verify Trezor signatures.",
          "To keep Workbolt secure and fix problems.",
        ],
      ],
    },
    {
      heading: "Who else processes your data",
      blocks: [
        "Workbolt relies on these services. Each sees only what it needs:",
        [
          "Google: signs you in.",
          "Supabase: stores the database and handles sign-in sessions.",
          "Vercel: hosts the website.",
          "Flash: when you get paid or pay through Flash, it receives the wallet ID, the amount and a note with the task title.",
          "Lightning address providers: when Workbolt asks your Lightning address for an invoice.",
          "CoinGecko: your browser fetches the bitcoin price from it to show naira estimates, so it sees your IP address.",
          "Trezor: Trezor Connect runs in your browser when you verify with a Trezor.",
        ],
        "Lightning payments themselves travel over the Lightning Network between your wallets.",
      ],
    },
    {
      heading: "How long we keep it",
      blocks: [
        "We keep your profile and tasks while your account exists, so the board keeps an accurate record. Server logs are kept by our providers for their usual periods.",
      ],
    },
    {
      heading: "Your choices and rights",
      blocks: [
        [
          "Change your name, skills and payout details at any time on your profile page.",
          "Ask for a copy of your data, a correction, or deletion of your account by emailing us.",
          "When an account is deleted, its profile and the tasks it posted are deleted. Tasks it took on stay on the board as a record of the work.",
        ],
        "If you are in Nigeria, the Nigeria Data Protection Act 2023 gives you rights over your personal data, including access, correction and deletion. If you think we've handled your data wrongly, you can complain to the Nigeria Data Protection Commission.",
      ],
    },
    {
      heading: "Security",
      blocks: [
        "Sign-in goes through Google, and the database only lets each person change their own profile and the task steps that are theirs. No system is perfectly secure, so please don't put passwords, private keys, seed phrases or other secrets anywhere on Workbolt. Workbolt will never ask for them.",
      ],
    },
    {
      heading: "Children",
      blocks: [
        "Workbolt is for adults. It is not meant for anyone under 18, and we don't knowingly collect their data.",
      ],
    },
    {
      heading: "Changes",
      blocks: [
        "We may update this policy. When we do, we change the date at the top.",
      ],
    },
  ],
};
