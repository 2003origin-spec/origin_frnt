---
title: "Real Numbers: Quick Practice"
type: practice
chapter: c10.mathematics.real-numbers
order: 4
---

Try each question first, then tap **Show answer**.

## Prime factorisation

:::question{title="1. Prime factors" exam="Board level"}
Express 4620 as a product of its prime factors.

---

$4620 = 2 \times 2310 = 2 \times 2 \times 1155$

$1155 = 3 \times 385 = 3 \times 5 \times 77 = 3 \times 5 \times 7 \times 11$

So $4620 =$ **$2^2 \times 3 \times 5 \times 7 \times 11$**.
:::

:::question{title="2. Last digit" exam="Board level"}
Check whether $12^n$ can end with the digit 0 for any natural number $n$.

---

To end with 0, the number must have both 2 and 5 as prime factors.

$12^n = 2^{2n} \times 3^n$. Its only primes are 2 and 3. By the uniqueness of prime factorisation, 5 can never appear.

So **no**, $12^n$ never ends with 0.
:::

:::question{title="3. Composite or not" exam="Board level"}
Explain why $3 \times 5 \times 7 \times 11 + 11$ is a composite number.

---

Take out the common factor 11:

$3 \times 5 \times 7 \times 11 + 11 = 11\,(105 + 1) = 11 \times 106$

It has a factor 11, other than 1 and itself. So it is **composite** (it equals 1166).
:::

## HCF and LCM

:::question{title="4. Two numbers" exam="Board level"}
Find the HCF and LCM of 84 and 120 by prime factorisation. Check that HCF × LCM = product of the numbers.

---

$84 = 2^2 \times 3 \times 7$ and $120 = 2^3 \times 3 \times 5$.

HCF $= 2^2 \times 3 =$ **12**. LCM $= 2^3 \times 3 \times 5 \times 7 =$ **840**.

Check: $12 \times 840 = 10080$ and $84 \times 120 = 10080$.
:::

:::question{title="5. Three numbers" exam="Board level"}
Find the HCF and LCM of 18, 45 and 60.

---

$18 = 2 \times 3^2$, $45 = 3^2 \times 5$, $60 = 2^2 \times 3 \times 5$.

The only prime common to all three is 3, with smallest power $3^1$. HCF $=$ **3**.

LCM $= 2^2 \times 3^2 \times 5 =$ **180**.

(Note: $3 \times 180 = 540$, but $18 \times 45 \times 60 = 48600$.)
:::

:::question{title="6. The other number" exam="Board level"}
The HCF of two numbers is 18 and their LCM is 1260. One number is 126. Find the other number.

---

For two numbers, HCF × LCM = product of the numbers:

$18 \times 1260 = 126 \times x$, so $x = \dfrac{22680}{126} =$ **180**.

Check: $126 = 2 \times 3^2 \times 7$ and $180 = 2^2 \times 3^2 \times 5$ give HCF 18 and LCM 1260.
:::

## Word problems

:::question{title="7. Three bells" exam="Board level"}
Three bells ring every 20, 24 and 30 minutes. They ring together at 8:00 am. When will they next ring together?

---

$20 = 2^2 \times 5$, $24 = 2^3 \times 3$, $30 = 2 \times 3 \times 5$.

LCM $= 2^3 \times 3 \times 5 = 120$ minutes $= 2$ hours.

They ring together again at **10:00 am**.
:::

:::question{title="8. Cutting ropes" exam="Board level"}
Two ropes are 84 m and 126 m long. Both are cut into pieces of equal length, with nothing left over. What is the greatest possible length of a piece? How many pieces are there in all?

---

$84 = 2^2 \times 3 \times 7$ and $126 = 2 \times 3^2 \times 7$.

HCF $= 2 \times 3 \times 7 = 42$. So each piece is **42 m** long.

Pieces: $\dfrac{84}{42} + \dfrac{126}{42} = 2 + 3 =$ **5 pieces**.
:::

## Irrational numbers

:::question{title="9. A proof" exam="Board level"}
Given that $\sqrt3$ is irrational, prove that $7 - 2\sqrt3$ is irrational.

---

Assume, to the contrary, that $7 - 2\sqrt3$ is rational. Then $7 - 2\sqrt3 = \dfrac{a}{b}$, with $a, b$ coprime integers and $b \ne 0$.

Rearranging: $2\sqrt3 = 7 - \dfrac{a}{b}$, so $\sqrt3 = \dfrac{7b - a}{2b}$.

Since $a$ and $b$ are integers, $\dfrac{7b - a}{2b}$ is rational. So $\sqrt3$ would be rational. This contradicts the fact that $\sqrt3$ is irrational.

So **$7 - 2\sqrt3$ is irrational**.
:::

:::question{title="10. Rational or irrational?" exam="Board level"}
Say whether each number is rational or irrational.

(i) $(2 + \sqrt3)(2 - \sqrt3)$

(ii) $(1 + \sqrt2)^2$

---

(i) $(2 + \sqrt3)(2 - \sqrt3) = 2^2 - (\sqrt3)^2 = 4 - 3 = 1$. **Rational.**

(ii) $(1 + \sqrt2)^2 = 1 + 2\sqrt2 + 2 = 3 + 2\sqrt2$.

$2\sqrt2$ is irrational (non-zero rational × irrational), and 3 plus an irrational is irrational. **Irrational.**
:::
