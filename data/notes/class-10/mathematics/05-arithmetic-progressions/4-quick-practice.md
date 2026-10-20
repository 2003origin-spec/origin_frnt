---
title: "Arithmetic Progressions: Quick Practice"
type: practice
chapter: c10.mathematics.arithmetic-progressions
order: 4
---

Try each question first, then tap **Show answer**.

## The nth term

:::question{title="1. A term" exam="Board level"}
Find the 18th term of the AP $3, 7, 11, \dots$

---

$a = 3$, $d = 7 - 3 = 4$. So $a_{18} = 3 + 17 \times 4 =$ **71**.
:::

:::question{title="2. Which term?" exam="Board level"}
Which term of the AP $5, 9, 13, \dots$ is 105?

---

$105 = 5 + (n - 1) \times 4$, so $n - 1 = 25$. It is the **26th term**.
:::

:::question{title="3. Is it a term?" exam="Board level"}
Is 200 a term of the AP $4, 10, 16, \dots$?

---

$200 = 4 + (n - 1) \times 6$ gives $n - 1 = \dfrac{196}{6} = \dfrac{98}{3}$, so $n = \dfrac{101}{3}$.

$n$ is not a whole number. **No, 200 is not a term.**
:::

:::question{title="4. Counting numbers" exam="Board level"}
How many three-digit numbers leave a remainder of 1 when divided by 4?

---

These numbers are $101, 105, 109, \dots, 997$. It is an AP with $a = 101$ and $d = 4$.

$997 = 101 + (n - 1) \times 4$ gives $n - 1 = 224$, so there are **225** such numbers.
:::

:::question{title="5. AP from two terms" exam="Board level"}
The 4th term of an AP is 11 and the 10th term is 29. Find its 20th term.

---

$a + 3d = 11$ and $a + 9d = 29$. Subtracting, $6d = 18$, so $d = 3$ and $a = 2$.

$a_{20} = 2 + 19 \times 3 =$ **59**.
:::

:::question{title="6. From the end" exam="Board level"}
Find the 8th term from the end of the AP $7, 11, 15, \dots, 183$.

---

Reverse the AP: first term 183, common difference $-4$.

8th term $= 183 + 7 \times (-4) =$ **155**.

(Check: the AP has $\frac{183 - 7}{4} + 1 = 45$ terms, and the 38th term is $7 + 37 \times 4 = 155$.)
:::

## Sum of n terms

:::question{title="7. Weekly savings" exam="Board level"}
Asha saves ₹ 20 in the first week. Each week after that, she saves ₹ 5 more than the week before. How much does she save in total in the first 20 weeks?

---

$a = 20$, $d = 5$, $n = 20$.

$S_{20} = \dfrac{20}{2}\left[40 + 19 \times 5\right] = 10 \times 135 =$ **₹ 1350**.
:::

:::question{title="8. Sum to a last term" exam="Board level"}
Find $11 + 14 + 17 + \cdots + 95$.

---

Number of terms: $\dfrac{95 - 11}{3} + 1 = 29$.

$S = \dfrac{29}{2}(11 + 95) = 29 \times 53 =$ **1537**.
:::

:::question{title="9. Term from the sum" exam="Board level"}
The sum of the first $n$ terms of an AP is $S_n = 2n^2 + 3n$. Find its 12th term.

---

$a_{12} = S_{12} - S_{11} = (288 + 36) - (242 + 33) = 324 - 275 =$ **49**.

(The AP is $5, 9, 13, \dots$ with $a = S_1 = 5$ and $d = 4$; $5 + 11 \times 4 = 49$.)
:::

:::question{title="10. Two answers" exam="Board level"}
How many terms of the AP $27, 24, 21, \dots$ must be taken so that their sum is 126?

---

$126 = \dfrac{n}{2}\left[54 + (n - 1)(-3)\right] = \dfrac{n}{2}(57 - 3n)$.

So $3n^2 - 57n + 252 = 0$, that is $n^2 - 19n + 84 = 0$, and $(n - 7)(n - 12) = 0$.

**7 or 12 terms.** Both are correct: the 8th to 12th terms are $6, 3, 0, -3, -6$, which add up to zero.
:::
