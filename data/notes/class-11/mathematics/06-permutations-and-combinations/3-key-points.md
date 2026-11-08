---
title: "Permutations and Combinations: Important Points and Traps"
type: key_points
chapter: c11.mathematics.permutations-and-combinations
order: 3
---

## Order or no order?

:::remember
- **Permutation = arrangement** (order matters). **Combination = selection** (order does not matter).
- $^{n}P_{r} = {}^{n}C_{r} \times r!$, so $^{n}P_{r} \ge {}^{n}C_{r}$ always.
- $0! = 1$, $^{n}P_{0} = 1$, $^{n}C_{0} = 1$, $^{n}C_{n} = 1$, $^{n}P_{n} = n!$, $^{n}P_{1} = {}^{n}C_{1} = n$.
:::

:::tip
**P** for **P**osition, **C** for **C**hoose (or **C**ommittee). Ask: "If I swap two of the chosen things, do I get something new?" Yes means permutation; no means combination.
:::

:::trap
Same people, different questions. 10 friends **shake hands** once with each other: $^{10}C_{2} = 45$. 10 friends each **send a card** to every other: $^{10}P_{2} = 90$ (A to B and B to A are different).
:::

## Repetition

:::trap
**With repetition, the thing that makes the choice goes in the base.** 5 letters posted in 3 letter boxes: each **letter** chooses a box, so $3^5 = 243$, not $5^3$.

Ask: "Who is choosing, and how many options does each have?" The answer is (options)$^{\text{choosers}}$.
:::

- "Repetition allowed": each place has all $n$ choices, giving $n^r$. "Not allowed": choices drop by one each time, giving $^{n}P_{r}$.
- When a list of digits has repeats (like 1, 2, 0, 2, 4, 2, 4), each digit can be used **only as many times as it appears** in the list (NCERT note after Example 23).

## Digits and numbers

:::trap
**The first digit cannot be 0.** Either fill the first place first (avoiding 0), or count all arrangements and subtract those that start with 0.
:::

- Fill the **most restricted place first**: units place for even or odd numbers, last two digits for divisibility by 4, the first place for "greater than ...".
- For even numbers from digits that include 0, split into cases: units digit 0, and units digit some other even digit. The first-place choices differ in the two cases.
- "Between 100 and 1000" means 3-digit numbers. Check whether the end values are included.

## Together, not together, no two together

:::trap
"**All vowels not together**" and "**no two vowels together**" are different questions.
- Not all together = total $-$ all together. (DAUGHTER: 36000)
- No two together = gap method. (DAUGHTER: 14400)
:::

- Block method: after arranging the blocks, **multiply by the arrangements inside the block**. Forgetting the $3!$ inside the vowel block is a common slip.
- Gap method: $k$ objects in a row make $k + 1$ gaps (both ends included). Place the restricted objects in different gaps.

## Identical objects

:::trap
Divide by $p!$ **only for objects that are identical**. In ALLAHABAD divide by $4!$ (A) and $2!$ (L), not by anything for B, H, D.

In a block, the letters inside the block may also repeat. In INDEPENDENCE the vowel block EEEEI has $\dfrac{5!}{4!} = 5$ arrangements, not $5!$.
:::

## Solving equations in n and r

:::trap
After solving, keep only values that make sense: $n$ and $r$ are whole numbers with $0 \le r \le n$.

$5 \cdot {}^{4}P_{r} = 6 \cdot {}^{5}P_{r-1}$ gives $r^2 - 11r + 24 = 0$, so $r = 3$ or $r = 8$. The NCERT solution (Example 13) ends with both values. But $^{4}P_{r}$ needs $r \le 4$, so $^{4}P_{8}$ is not defined, and only $r = 3$ works. Check: $5 \times 24 = 6 \times 20 = 120$.
:::

:::trap
$^{n}C_{a} = {}^{n}C_{b}$ does **not** always mean $a = b$. It can also mean $a + b = n$. From $^{n}C_{9} = {}^{n}C_{8}$ we get $n = 17$ (NCERT Example 17).
:::

## Selections with conditions

:::trap
**Overcounting in "at least one".** Team of 5 from 4 girls and 7 boys with at least one girl.

Wrong: choose 1 girl ($4$ ways), then any 4 of the other 10 ($^{10}C_{4} = 210$), giving 840. Each team with two or more girls is counted more than once.

Right: $^{11}C_{5} - {}^{7}C_{5} = 462 - 21 = 441$.
:::

- "At least $k$": add the exact cases from $k$ up to the largest possible, or use total minus the cases below $k$.
- A case that is impossible counts 0. NCERT Example 21: a team cannot have 5 girls if there are only 4.
- "Must include" a person: select them first, then choose the rest from the others. "Must exclude": remove them from the pool.

## Exam extras (JEE Main, not in NCERT)

Not in the NCERT book; JEE Main asks them as "simple applications".

:::trap
**Groups of equal size.** Splitting 4 people into **2 pairs**: $\dfrac{^{4}C_{2}}{2!} = 3$, not 6, because the two pairs have no names. If the pairs are named (Team A and Team B), the answer is 6.
:::

- Circle of $n$ different people: $(n-1)!$. If the seats are numbered, every seat is different, so it is $n!$.
- Necklace or garland of $n \ge 3$ different beads: $\dfrac{(n-1)!}{2}$, only when flipping it over gives the same thing.
- With $m$ points on one line: lines $= {}^{n}C_{2} - {}^{m}C_{2} + 1$, triangles $= {}^{n}C_{3} - {}^{m}C_{3}$.
- $^{n}C_{r}$ is largest at the middle value(s) of $r$: $r = \dfrac{n}{2}$ for even $n$, and both $r = \dfrac{n-1}{2}$ and $r = \dfrac{n+1}{2}$ for odd $n$.
