import os

from groq import Groq

client = Groq(api_key=os.getenv("GROQ_API_KEY"))
MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")


def explain_changes(url: str, profile: str | None, added: list, removed: list) -> str:
    """Ask Groq to explain the change in plain English for THIS user."""
    if not added and not removed:
        return "No meaningful changes were detected."

    added_text = "\n".join(f"- {c['text']}" for c in added) or "(none)"
    removed_text = "\n".join(f"- {c['text']}" for c in removed) or "(none)"

    prompt = f"""A page the user watches has changed. Here is the change.

Who the user is: {profile or "a general user"}

Page: {url}

Clauses ADDED or CHANGED:
{added_text}

Clauses REMOVED:
{removed_text}

Explain in plain, simple English:
1. What actually changed (2-4 short bullet points).
2. How it affects THIS user specifically, given who they are.
Keep it friendly and under 150 words. Do NOT invent clauses that are not listed above."""

    response = client.chat.completions.create(
        model=MODEL,
        messages=[
            {
                "role": "system",
                "content": "You explain legal and policy fine-print changes to ordinary people in clear, simple language.",
            },
            {"role": "user", "content": prompt},
        ],
        temperature=0.3,
    )
    return response.choices[0].message.content.strip()


def summarize_clauses(clauses: list[str]) -> str:
    """Ask Groq to summarize the key points of a page's fine print."""
    if not clauses:
        return "This page has no readable fine print to summarize."

    # Cap the size so the prompt stays small.
    joined = "\n".join(f"- {c}" for c in clauses[:60])

    prompt = f"""Here are clauses from a page of fine print (terms, policy, or rules):

{joined}

Summarize the KEY points a normal person should know, as 3-6 short bullet points,
in plain simple English. Focus on money/fees, cancellation, data & privacy,
obligations, and anything risky. Keep it under 120 words."""

    response = client.chat.completions.create(
        model=MODEL,
        messages=[
            {
                "role": "system",
                "content": "You explain fine print to ordinary people in clear, simple language.",
            },
            {"role": "user", "content": prompt},
        ],
        temperature=0.3,
    )
    return response.choices[0].message.content.strip()