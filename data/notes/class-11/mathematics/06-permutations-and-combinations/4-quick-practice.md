---
title: "Permutations and Combinations: Quick Practice"
type: practice
chapter: c11.mathematics.permutations-and-combinations
order: 4
---

Try each question first, then tap **Show answer**.

## Counting and permutations

:::question{title="1. Even numbers with 0" exam="JEE Main level"}
How many 4-digit even numbers can be formed with the digits 0, 1, 2, 3, 4, 5, 6 if no digit is repeated?

---

**Units digit 0:** the other three places from the 6 digits left: $6 \times 5 \times 4 = 120$.

**Units digit 2, 4 or 6:** first place 5 ways (not 0, not the units digit), then $5 \times 4$ for the middle: $3 \times 5 \times 20 = 300$.

Total **420**. Check: all 4-digit numbers are $^{7}P_{4} - {}^{6}P_{3} = 720$, and the odd ones are $3 \times 5 \times 20 = 300$, so $720 - 300 = 420$.
:::

:::question{title="2. Find n" exam="JEE Main level"}
Find $n$ if $^{n}P_{4} = 20 \times {}^{n}P_{2}$.

---

$n(n-1)(n-2)(n-3) = 20\,n(n-1)$. For $n \ge 4$, divide by $n(n-1)$: $(n-2)(n-3) = 20$.

So $n^2 - 5n - 14 = 0$, that is $(n-7)(n+2) = 0$. Reject $-2$: **$n = 7$**.

Check: $^{7}P_{4} = 840$ and $20 \times {}^{7}P_{2} = 20 \times 42 = 840$.
:::

:::question{title="3. No two girls together" exam="JEE Main level"}
In how many ways can 4 boys and 3 girls sit in a row so that no two girls sit next to each other?

---

Seat the boys: $4! = 24$ ways. They make 5 gaps: $\times B \times B \times B \times B \times$.

Put the 3 girls in 3 different gaps: $^{5}P_{3} = 60$ ways.

Total $24 \times 60 =$ **1440**.
:::

## Letters and words

:::question{title="4. BALLOON" exam="JEE Main level"}
In how many arrangements of the letters of BALLOON are the two L's **not** next to each other?

---

All arrangements: $\dfrac{7!}{2!\,2!} = 1260$ (L twice, O twice).

L's together (one block LL): $\dfrac{6!}{2!} = 360$ (O still twice).

Not together: $1260 - 360 =$ **900**.

Check by gaps: arrange B, A, O, O, N in $\dfrac{5!}{2!} = 60$ ways, then choose 2 of the 6 gaps for the identical L's: $60 \times {}^{6}C_{2} = 60 \times 15 = 900$.
:::

:::question{title="5. Rank of a word" exam="JEE Main level"}
All arrangements of the letters of SCHOOL are listed in dictionary order. What is the position of SCHOOL?

---

Alphabetical order: C, H, L, O, O, S.

Starting with C, H or L: $\dfrac{5!}{2!} = 60$ each, so 180. Starting with O: $5! = 120$. Total 300.

Starting with S: SC and then SCH match. At the 4th place, L comes before O: SCHL then OO gives 1 word. At the 5th place, L comes before O: SCHOLO gives 1 word.

Words before SCHOOL: $300 + 1 + 1 = 302$. Position **303**.
:::

:::question{title="6. Select and arrange" exam="JEE Main level"}
How many 5-letter words (with or without meaning), each with 2 different vowels and 3 different consonants, can be made from the letters of EQUATIONS?

---

EQUATIONS has 5 vowels (E, U, A, I, O) and 4 consonants (Q, T, N, S), all different.

Choose: $^{5}C_{2} \times {}^{4}C_{3} = 10 \times 4 = 40$. Arrange each choice: $5! = 120$.

Total $40 \times 120 =$ **4800**.
:::

## Combinations

:::question{title="7. Equal C values" exam="JEE Main level"}
If $^{n}C_{6} = {}^{n}C_{10}$, find $^{n}C_{14}$.

---

$6 \ne 10$, so $6 + 10 = n$, giving $n = 16$.

$^{16}C_{14} = {}^{16}C_{2} = \dfrac{16 \times 15}{2} =$ **120**.
:::

:::question{title="8. At least two women" exam="JEE Main level"}
A committee of 5 is chosen from 6 men and 4 women. In how many ways can it have at least 2 women?

---

Cases: 2W 3M $= 6 \times 20 = 120$; 3W 2M $= 4 \times 15 = 60$; 4W 1M $= 1 \times 6 = 6$. Total **186**.

Check by complement: $^{10}C_{5} = 252$. No woman: $^{6}C_{5} = 6$. One woman: $4 \times {}^{6}C_{4} = 60$. So $252 - 66 = 186$.
:::

:::question{title="9. Collinear points (exam extra)" exam="JEE Main level"}
There are 12 points in a plane. Exactly 5 of them lie on one straight line, and no other three are on a line. How many triangles can be formed with these points as vertices?

---

Any 3 points make a triangle unless all 3 are on the line: $^{12}C_{3} - {}^{5}C_{3} = 220 - 10 =$ **210**.

Check by cases (7 points off the line): none from the line $^{7}C_{3} = 35$; one $5 \times 21 = 105$; two $10 \times 7 = 70$. Total $210$.
:::

:::question{title="10. Diagonals (exam extra)" exam="JEE Main level"}
A polygon has 35 diagonals. How many sides does it have?

---

Diagonals $= {}^{n}C_{2} - n = \dfrac{n(n-3)}{2} = 35$, so $n^2 - 3n - 70 = 0$, that is $(n-10)(n+7) = 0$.

The polygon has **10 sides**. Check: $^{10}C_{2} - 10 = 45 - 10 = 35$.
:::
