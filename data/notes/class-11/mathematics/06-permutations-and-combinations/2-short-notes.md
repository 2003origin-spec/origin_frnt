---
title: "Permutations and Combinations: Short Notes"
type: short_notes
chapter: c11.mathematics.permutations-and-combinations
order: 2
---

## 1. Fundamental principle of counting

- **Multiplication principle:** if one event can happen in $m$ ways, and after it another event can happen in $n$ ways, both can happen (in that order) in $m \times n$ ways. It extends to any number of events.
- Use it when a job is done in **steps**, one after another ("and").
- When a job is done in **one of several separate cases** ("or"), find each case and **add** them. NCERT does this in Example 4 (signals of 2, 3, 4 or 5 flags: $20 + 60 + 120 + 120 = 320$).

:::tip
Think of **boxes to fill**. Write one box per place, put the number of choices in each box, then multiply. Fill the box with a **restriction first** (units place for an even number, first place that cannot be 0).
:::

:::example{title="Repetition allowed"}
2-digit even numbers from 1, 2, 3, 4, 5 with repetition (NCERT Example 3): units place 2 ways (2 or 4), tens place 5 ways. Total $2 \times 5 = 10$.
:::

## 2. Factorial

- $n! = 1 \times 2 \times \cdots \times n$, defined for natural numbers, with $0! = 1$.
- $n! = n\,(n-1)!$, so ratios cancel fast: $\dfrac{7!}{5!} = 7 \times 6 = 42$.
- Values to know: $3! = 6$, $4! = 24$, $5! = 120$, $6! = 720$, $7! = 5040$.

## 3. Permutations: arrangements

- A **permutation** is an arrangement in a definite **order** of some or all of a set of objects. $AB$ and $BA$ are different permutations.
- $n$ different objects, $r$ at a time, no repetition: $^{n}P_{r} = \dfrac{n!}{(n-r)!}$, for $0 \le r \le n$.
- With repetition allowed: $n^r$ (each place has all $n$ choices).
- All $n$ different objects in a row: $n!$ ways.

:::example{title="Numbers with a zero"}
3-digit numbers from 0, 1, 2, 3, 4, 5, no repetition (NCERT Example 11): all arrangements $^{6}P_{3} = 120$, minus those starting with 0, which are $^{5}P_{2} = 20$. Answer $100$.
:::

## 4. Together and not together

- **Together (block method):** tie the objects that must be together into one block. Arrange the block with the others, then multiply by the arrangements inside the block.
- **Not all together:** total arrangements minus the "all together" ones.
- **No two together (gap method):** arrange the other objects first. Then place the restricted objects in the gaps between them (and at the two ends), one per gap.

:::example{title="DAUGHTER (vowels A, U, E)"}
All vowels together: $6! \times 3! = 4320$.

Vowels not all together: $8! - 4320 = 36000$.

No two vowels together: $5! \times {}^{6}P_{3} = 120 \times 120 = 14400$ (5 consonants make 6 gaps).
:::

## 5. Objects that are not all different

- $n$ objects with $p_1$ alike, $p_2$ alike, ..., $p_k$ alike (the rest different) can be arranged in $\dfrac{n!}{p_1!\,p_2!\cdots p_k!}$ ways.
- Why: swapping identical objects gives the same arrangement, so each one was counted $p_1!\,p_2!\cdots$ times.

:::example{title="ALLAHABAD"}
9 letters with A four times and L twice: $\dfrac{9!}{4!\,2!} = 7560$.
:::

## 6. Combinations: selections

- A **combination** is a **selection**; order does not matter. Team $\{X, Y\}$ is the same as $\{Y, X\}$.
- $^{n}C_{r} = \dfrac{n!}{r!\,(n-r)!}$, for $0 \le r \le n$.
- Each selection of $r$ objects can be arranged in $r!$ ways, so $^{n}P_{r} = {}^{n}C_{r} \times r!$.
- Handshakes among 12 people: $^{12}C_{2} = 66$. Chords through 7 points on a circle: $^{7}C_{2} = 21$.

| Question asks for | Use | Clue words |
|---|---|---|
| Arrangement | $^{n}P_{r}$ | words, numbers, signals, seating, posts |
| Selection | $^{n}C_{r}$ | team, committee, group, handshakes, chords |
| Select, then arrange | $^{n}C_{r} \times r!$ | "words with 3 vowels and 2 consonants" |

## 7. Properties of nCr

- $^{n}C_{r} = {}^{n}C_{n-r}$: choosing $r$ is the same as rejecting $n - r$.
- $^{n}C_{a} = {}^{n}C_{b}$ means $a = b$ or $a + b = n$.
- Pascal's rule: $^{n}C_{r} + {}^{n}C_{r-1} = {}^{n+1}C_{r}$.

## 8. "At least" and "at most"

- Split into cases by the exact number (exactly 3, exactly 4, ...) and **add**.
- Or use the **complement**: total minus the cases you don't want. This is shorter when the unwanted side has fewer cases.

:::example{title="At least one boy and one girl"}
Team of 5 from 4 girls and 7 boys (NCERT Example 21): total $^{11}C_{5} = 462$. All-boy teams: $^{7}C_{5} = 21$. All-girl teams: 0 (only 4 girls). Answer $462 - 21 = 441$, the same as adding the four cases.
:::

## 9. Dictionary order (rank of a word)

- Put the letters in alphabetical order.
- For each position from the left, count the words that start with the same letters so far but have a **smaller** letter in this position. Add all these counts.
- Rank = that total + 1. With repeated letters, each count is (letters left)! divided by the factorials of the repeats among the letters left.

## 10. Exam extras (JEE Main, not in NCERT)

These are not in the NCERT book, but JEE Main asks them as "simple applications" of this chapter.


- **Circle:** $n$ different people round a table in $(n-1)!$ ways. Fix one person; arrange the rest in a row.
- **Necklace or garland:** $\dfrac{(n-1)!}{2}$ for $n \ge 3$ different beads, since clockwise and anticlockwise look the same.
- **Triangles and diagonals:** $n$ points, no three on a line, give $^{n}C_{2}$ lines and $^{n}C_{3}$ triangles. An $n$-gon has $\dfrac{n(n-3)}{2}$ diagonals.
- **Identical things to people:** $x_1 + \cdots + x_r = n$ with each $x_i \ge 0$ has $^{n+r-1}C_{r-1}$ solutions. Example: $x + y + z = 10$ has $^{12}C_{2} = 66$.
- **Divisors:** $360 = 2^3 \cdot 3^2 \cdot 5$ has $(3+1)(2+1)(1+1) = 24$ divisors.
- **At least one from $n$ different things:** $2^n - 1$. NCERT's history note says Sushruta counted $63 = 2^6 - 1$ combinations of 6 tastes.
