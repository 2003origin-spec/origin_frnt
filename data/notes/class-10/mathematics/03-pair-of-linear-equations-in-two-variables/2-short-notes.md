---
title: "Linear Equations in Two Variables: Short Notes"
type: short_notes
chapter: c10.mathematics.pair-of-linear-equations-in-two-variables
order: 2
---

## 1. What a pair of linear equations is

- A **linear equation in two variables** looks like $ax + by + c = 0$, where $a$ and $b$ are not both zero. You met it in Class 9.
- Two such equations in the same two variables form a **pair of linear equations**.
- A **solution of the pair** is a pair of values $(x, y)$ that makes both equations true at the same time.
- Real-life problems give such pairs. Example: "rides cost ₹ 3, games cost ₹ 4, she spent ₹ 20, and played half as many games as rides" gives $y = \frac12 x$ and $3x + 4y = 20$, where $x$ is the number of rides and $y$ the number of games.

## 2. Graphical method

- The graph of each equation is a **straight line**. Find two points on it (make a small table of $x$ and $y$), plot them, and join them.
- Draw both lines on the same axes. Then one of three things happens:

| The lines | Solutions | The pair is |
|---|---|---|
| Intersect at one point | Exactly one | Consistent |
| Coincide (same line) | Infinitely many | Dependent (consistent) |
| Are parallel | None | Inconsistent |

- If the lines intersect, the **point where they meet** is the solution.
- A pair with no solution is **inconsistent**. A pair with a solution is **consistent**. A dependent pair is always consistent.

:::example{title="Reading the graph"}
$x + 3y = 6$ passes through $(0, 2)$ and $(6, 0)$. $2x - 3y = 12$ passes through $(0, -4)$ and $(3, -2)$. Both lines pass through $(6, 0)$, so the solution is $x = 6$, $y = 0$.
:::

- The graphical method is **not good** when the answer has fractions, such as $\left(\frac{4}{13}, \frac{1}{19}\right)$. You cannot read such points exactly from a graph. Use an algebraic method then.

## 3. Comparing the ratios

Write both equations as $a_1x + b_1y + c_1 = 0$ and $a_2x + b_2y + c_2 = 0$. Then compare $\dfrac{a_1}{a_2}$, $\dfrac{b_1}{b_2}$ and $\dfrac{c_1}{c_2}$.

| Ratios | Lines | Solutions |
|---|---|---|
| first two **not equal** | Intersecting | One |
| all three equal | Coincident | Infinitely many |
| first two equal, third different | Parallel | None |

- The converse is also true. For example, if the lines are parallel, then the first two ratios are equal and the third is different.
- This tells you the **type** of the pair without drawing a graph.

:::example{title="Checking a pair"}
$2x + 3y - 9 = 0$ and $4x + 6y - 18 = 0$: the ratios are $\frac24 = \frac36 = \frac{-9}{-18} = \frac12$. All equal, so the lines coincide: infinitely many solutions.
:::

## 4. Substitution method

**Steps**
1. From one equation, write one variable in terms of the other. Pick the easier one, for example $x = 3 - 2y$.
2. Put this into the **other** equation. You get an equation in one variable. Solve it.
3. Put that value back into the expression from Step 1 to get the other variable.

- If Step 2 leaves **no variable**:
  - a **true** statement (such as $18 = 18$) means infinitely many solutions;
  - a **false** statement (such as $-4 = 0$) means no solution.

:::example{title="Substitution"}
Solve $7x - 15y = 2$ and $x + 2y = 3$.

From the second, $x = 3 - 2y$. Then $7(3 - 2y) - 15y = 2$, so $21 - 29y = 2$ and $y = \frac{19}{29}$.

Then $x = 3 - \frac{38}{29} = \frac{49}{29}$.
:::

## 5. Elimination method

"Eliminate" means remove. We remove one variable by adding or subtracting the equations.

**Steps**
1. Multiply the equations by suitable **non-zero** numbers so that one variable has the same coefficient (up to sign) in both.
2. Add or subtract the equations, so that this variable disappears.
3. Solve the equation in one variable that is left.
4. Put this value into either **original** equation to get the other variable.

- Same rule as before: if Step 2 leaves no variable, a true statement means infinitely many solutions, a false one means no solution.

:::example{title="Elimination"}
$9x - 4y = 2000$ and $7x - 3y = 2000$.

Multiply the first by 3 and the second by 4: $27x - 12y = 6000$ and $28x - 12y = 8000$.

Subtract: $x = 2000$. Then $9(2000) - 4y = 2000$ gives $y = 4000$.
:::

- If the same sign is in front of the equal terms, **subtract**. If opposite signs, **add**.

## 6. Which method to use

| Situation | Best method |
|---|---|
| A variable has coefficient 1 or −1 | Substitution |
| Coefficients are bigger numbers | Elimination |
| Only the type is asked | Compare ratios |
| A drawing is asked | Graphical |

All methods give the same answer. Use the one the question asks for.

## 7. Word problems

1. Name the two unknowns: "Let the cost of one pen be ₹ $x$ and one pencil be ₹ $y$."
2. Turn each sentence into one equation.
3. Solve the pair.
4. **Check** the answer in the words of the question, not just in your equations.

- Counts (people, notes, pants) must be whole numbers and not negative. Zero is allowed: in one NCERT example the answer is 1 pant and 0 skirts.
- Some questions have **two** answers. Example: a two-digit number whose digits differ by 2 can have the bigger digit in either place, so both cases must be solved (42 and 24 in the book).

:::remember
The current NCERT book teaches the **graphical**, **substitution** and **elimination** methods. The cross-multiplication method and the section on equations "reducible to a pair of linear equations" were removed from the current book. (One leftover line in the chapter summary still mentions the second, but there are no examples or exercises on it.)
:::
