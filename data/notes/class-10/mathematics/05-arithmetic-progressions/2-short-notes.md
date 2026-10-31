---
title: "Arithmetic Progressions: Short Notes"
type: short_notes
chapter: c10.mathematics.arithmetic-progressions
order: 2
---

## 1. Patterns in lists of numbers

- Many lists follow a rule. In some, you **add** a fixed number each time. In others, you **multiply** by a fixed number, or take squares.
- This chapter is only about lists where you **add a fixed number** each time.
- Each number in the list is called a **term**.

## 2. What is an AP?

- An **arithmetic progression (AP)** is a list of numbers in which each term, except the first, is found by adding a fixed number to the term before it.
- The fixed number is the **common difference** $d$. It can be positive, negative or zero.
- General form: $a,\ a + d,\ a + 2d,\ a + 3d,\ \dots$

| List | $a$ | $d$ |
|---|---|---|
| 4, 9, 14, 19, ... | 4 | 5 |
| 30, 22, 14, 6, ... | 30 | −8 |
| 5, 5, 5, 5, ... | 5 | 0 |
| −2, −1.5, −1, ... | −2 | 0.5 |

- Real-life APs: a salary that rises by the same amount every year, savings that go up by a fixed amount each week, simple interest at the end of each year, rows of plants that drop by 2 in each row.

## 3. How to check if a list is an AP

- Find $a_2 - a_1$, $a_3 - a_2$, $a_4 - a_3$, and so on.
- If all these differences are the **same**, the list is an AP, and that value is $d$.
- If even one difference is different, it is **not** an AP.
- Once you know a list is an AP, you need only one difference to get $d$.

:::example{title="AP or not?"}
$2, 6, 10, 14, \dots$: the differences are 4, 4, 4. It is an AP with $d = 4$.

$1, 2, 4, 8, \dots$: the differences are 1, 2, 4. **Not** an AP (each term is doubled, not increased by a fixed amount).

$1^2, 2^2, 3^2, \dots$ (that is 1, 4, 9, ...): the differences are 3, 5. **Not** an AP.
:::

## 4. Finite and infinite APs

- A **finite AP** has a fixed number of terms, so it has a **last term** $l$. Example: the cash prizes 200, 250, ..., 750.
- An **infinite AP** goes on for ever and has no last term. Example: $1, 2, 3, 4, \dots$

## 5. The nth term

- Each step adds $d$. To reach the $n$th term from the first term you take $n - 1$ steps. So
$$a_n = a + (n - 1)\,d$$
- $a_n$ is also called the **general term**.
- The formula links four things: $a_n$, $a$, $n$ and $d$. Know any three and you can find the fourth.

:::example{title="Finding a term"}
20th term of $5, 8, 11, \dots$: $a = 5$, $d = 3$, so $a_{20} = 5 + 19 \times 3 = 62$.
:::

### Common uses of the nth term

- **Which term is a given number?** Put $a_n$ = that number and solve for $n$.
- **Is a number a term at all?** Solve for $n$. If $n$ is not a positive whole number, the number is **not** a term.
- **Finding the AP from two terms.** Write both terms with the formula. You get two linear equations in $a$ and $d$. Solve them.
- **Counting.** For example, two-digit multiples of 3 are $12, 15, \dots, 99$. Use $99 = 12 + (n - 1) \times 3$, which gives $n = 30$.
- **Term from the end.** Either reverse the AP (first term $l$, common difference $-d$), or count the terms first and work from the start.

:::example{title="Term from the end"}
AP $10, 7, 4, \dots, -62$ has 25 terms. The 11th term from the end is the 15th term from the start: $10 + 14 \times (-3) = -32$.

Reversed: $-62 + 10 \times 3 = -32$. Same answer.
:::

## 6. Sum of the first n terms

- **Gauss's idea:** write the sum forwards and backwards, then add. For $1 + 2 + \cdots + 100$, each pair adds to 101, and there are 100 pairs. So $2S = 100 \times 101$ and $S = 5050$.
- Doing the same with $a, a + d, \dots, a + (n - 1)d$ gives
$$S_n = \frac{n}{2}\left[2a + (n - 1)\,d\right]$$
- Since $a + (n - 1)d$ is the last term $l$, this is also
$$S_n = \frac{n}{2}\,(a + l)$$
- In words: sum = (number of terms) × (average of the first and last terms).

:::example{title="A sum"}
$2 + 7 + 12 + \cdots$ to 10 terms: $S_{10} = \dfrac{10}{2}\left[4 + 9 \times 5\right] = 5 \times 49 = 245$.
:::

## 7. Using the sum formula

- **Find $n$ from the sum.** Put the values in $S_n$. You get a quadratic in $n$. Keep only positive whole-number answers.
- Sometimes **both** roots are correct. This can only happen when the terms change sign (for example, $a$ positive and $d$ negative). Then a block of terms in the middle adds up to zero.
- **Find a term from the sums.** $a_n = S_n - S_{n-1}$ (for $n \ge 2$), and $a_1 = S_1$.
- **List given by a formula.** If $a_n = 3 + 2n$, the terms are $5, 7, 9, \dots$ This is an AP with $d = 2$. Find a few terms, check the difference, then use $S_n$.
- **Sum of the first $n$ positive integers:** $\dfrac{n(n + 1)}{2}$.

## 8. Word problems

- First decide **what the terms are** (salary each year, plants in each row, money saved each week).
- Then decide what is asked: one term ($a_n$), how many terms ($n$), or a total ($S_n$).
- "In the 10th year" asks for $a_{10}$. "In the first 10 years" (total) asks for $S_{10}$.

:::remember
Simple interest at the end of each year forms an AP. Compound interest does **not**: each year's amount is the previous one multiplied by a fixed number.
:::
