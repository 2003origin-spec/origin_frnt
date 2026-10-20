---
title: "Sets: Quick Practice"
type: practice
chapter: c11.mathematics.sets
order: 4
---

Try each question first, then tap **Show answer**. Questions 3, 8, 9 and 10 use exam-extra results (not in the current NCERT).

## Writing sets and subsets

:::question{title="1. Roster form" exam="JEE Main level"}
Write $A = \{x : x \in \mathbf{Z} \text{ and } |2x - 1| \le 5\}$ in roster form and find $n(A)$.

---

$|2x - 1| \le 5$ means $-5 \le 2x - 1 \le 5$, so $-4 \le 2x \le 6$, that is $-2 \le x \le 3$.

$A = \{-2, -1, 0, 1, 2, 3\}$, so **$n(A) = 6$**.
:::

:::question{title="2. Element or subset" exam="JEE Main level"}
Let $A = \{1, \{2\}, \{1, 2\}, \phi\}$. Which statement is **false**?

- (a) $\{2\} \in A$
- (b) $\{1\} \subset A$
- (c) $\{2\} \subset A$
- (d) $\phi \subset A$

---

(a) True: $\{2\}$ is listed in $A$. (b) True: $1 \in A$. (d) True: $\phi$ is a subset of every set.

(c) needs $2 \in A$, but 2 itself is not listed (only $\{2\}$ is). The false one is **(c)**.
:::

:::question{title="3. Counting subsets" exam="JEE Main level"}
Set $A$ has 3 more elements than set $B$, and $A$ has 56 more subsets than $B$. Find $n(A) + n(B)$.

---

Let $n(B) = k$, so $n(A) = k + 3$. Then $2^{k+3} - 2^k = 56$, so $7 \times 2^k = 56$ and $2^k = 8$, $k = 3$.

$n(B) = 3$ and $n(A) = 6$, so $n(A) + n(B) =$ **9**.
:::

:::question{title="4. Intervals" exam="JEE Main level"}
Let $A = [-2, 5)$ and $B = (1, 7]$. Write $A \cap B$ and $A - B$ as intervals.

---

$A \cap B$: we need $x > 1$ and $x < 5$, so **$A \cap B = (1, 5)$**.

$A - B$: points of $A$ that are not in $B$, that is $x \le 1$. So **$A - B = [-2, 1]$** (1 is included, since $1 \notin B$).
:::

## Operations and laws

:::question{title="5. Complement of a union" exam="JEE Main level"}
$U = \{1, 2, \dots, 10\}$, $A$ = the primes in $U$, $B$ = the odd numbers in $U$. Find $(A \cup B)'$ and $A - B$.

---

$A = \{2, 3, 5, 7\}$ and $B = \{1, 3, 5, 7, 9\}$, so $A \cup B = \{1, 2, 3, 5, 7, 9\}$.

**$(A \cup B)' = \{4, 6, 8, 10\}$** and **$A - B = \{2\}$**.

Check with De Morgan: $A' \cap B' = \{1, 4, 6, 8, 9, 10\} \cap \{2, 4, 6, 8, 10\} = \{4, 6, 8, 10\}$.
:::

:::question{title="6. Simplify" exam="JEE Main level"}
Simplify $(A \cap B') \cup (A \cap B) \cup (A' \cap B)$.

---

By the distributive law, $(A \cap B') \cup (A \cap B) = A \cap (B' \cup B) = A \cap U = A$.

Also $A' \cap B = B - A$. So the whole set is $A \cup (B - A) =$ **$A \cup B$**.
:::

:::question{title="7. Always true?" exam="JEE Main level"}
Which one is true for **all** sets $A, B, C$?

- (a) $A \cap B = A \cap C \Rightarrow B = C$
- (b) $A - B = A \cap B'$
- (c) $(A \cup B)' = A' \cup B'$
- (d) $A - (B \cup C) = (A - B) \cup (A - C)$

---

(a) False: $A = \{1\}$, $B = \{1, 2\}$, $C = \{1, 3\}$. (c) False: De Morgan gives $A' \cap B'$. (d) False: $A = \{1, 2\}$, $B = \{1\}$, $C = \{2\}$ gives $\phi$ on the left and $\{1, 2\}$ on the right.

(b) Both sides are "in $A$ and not in $B$". Answer: **(b)**.
:::

## Counting (exam extra)

:::question{title="8. Neither" exam="JEE Main level"}
In a class of 60 students, 35 take Physics tuition, 28 take Maths tuition and 12 take both. How many take neither?

---

$n(P \cup M) = 35 + 28 - 12 = 51$, so neither $= 60 - 51 =$ **9**.
:::

:::question{title="9. Exactly one" exam="JEE Main level"}
Of 100 students, 45 read paper H, 40 read paper E and 30 read paper B. 15 read H and E, 10 read E and B, 12 read H and B, and 5 read all three. How many read **exactly one** paper?

---

Fill the Venn diagram from the inside. Pairs only: H and E only $= 15 - 5 = 10$, E and B only $= 10 - 5 = 5$, H and B only $= 12 - 5 = 7$.

Only H $= 45 - 10 - 7 - 5 = 23$. Only E $= 40 - 10 - 5 - 5 = 20$. Only B $= 30 - 5 - 7 - 5 = 13$.

Exactly one $= 23 + 20 + 13 =$ **56**.

Check: $115 - 2(37) + 3(5) = 56$.
:::

:::question{title="10. Size of the overlap" exam="JEE Main level"}
$A$ and $B$ are subsets of $U$, with $n(U) = 50$, $n(A) = 40$ and $n(B) = 25$. Find the least and the greatest possible value of $n(A \cap B)$.

---

Greatest: the overlap can't be bigger than $B$. It equals 25 when $B \subset A$.

Least: $n(A \cup B) \le 50$, so $40 + 25 - n(A \cap B) \le 50$, giving $n(A \cap B) \ge 15$.

**Least 15, greatest 25.**
:::
