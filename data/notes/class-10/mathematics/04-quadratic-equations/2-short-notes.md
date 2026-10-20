---
title: "Quadratic Equations: Short Notes"
type: short_notes
chapter: c10.mathematics.quadratic-equations
order: 2
---

## 1. What a quadratic equation is

- A **quadratic equation** in $x$ has the form $ax^2 + bx + c = 0$, where $a, b, c$ are real numbers and $a \ne 0$.
- In other words, it is $p(x) = 0$, where $p(x)$ is a polynomial of **degree 2**.
- Writing the terms in descending powers of $x$ gives the **standard form**. For example, $4x - 3x^2 + 2 = 0$ in standard form is $-3x^2 + 4x + 2 = 0$ (or $3x^2 - 4x - 2 = 0$).
- Real-life problems often lead to quadratic equations: areas, products of numbers, ages, speed and time.

**How to check if an equation is quadratic**
1. Expand both sides.
2. Bring every term to one side, so the other side is 0.
3. Simplify. It is quadratic only if the highest power left is $x^2$ (its coefficient is not 0).

:::example{title="Looks are not enough"}
$x(x + 4) = x^2 - 5$ becomes $x^2 + 4x = x^2 - 5$, that is $4x + 5 = 0$. The $x^2$ cancels, so it is **not** quadratic.

$(x + 1)^3 = x^3 + x$ becomes $x^3 + 3x^2 + 3x + 1 = x^3 + x$, that is $3x^2 + 2x + 1 = 0$. The $x^3$ cancels, so it **is** quadratic.
:::

## 2. Roots

- A real number $\alpha$ is a **root** (or solution) of $ax^2 + bx + c = 0$ if $a\alpha^2 + b\alpha + c = 0$. We say $\alpha$ **satisfies** the equation.
- The roots of the equation are the zeroes of the polynomial $ax^2 + bx + c$.
- A quadratic equation has **at most two** roots.
- To check a root, put it into the equation. Both sides must be equal.

## 3. Solving by factorisation

**Steps**
1. Write the equation in standard form, with 0 on the right.
2. Multiply $a$ and $c$. Find two numbers whose **product is $ac$** and whose **sum is $b$**.
3. Split the middle term $bx$ using these two numbers.
4. Group in pairs and take out common factors to get two linear factors.
5. Put each factor equal to 0 and solve.

:::example{title="Splitting the middle term"}
Solve $3x^2 - 5x - 2 = 0$.

$ac = 3 \times (-2) = -6$. We need two numbers with product $-6$ and sum $-5$: they are $-6$ and $1$.

$3x^2 - 6x + x - 2 = 3x(x - 2) + 1(x - 2) = (3x + 1)(x - 2)$

So $3x + 1 = 0$ or $x - 2 = 0$. The roots are $-\dfrac13$ and $2$.
:::

- If both factors are the same, as in $(x - 3)^2 = 0$, the root $3$ is **repeated**. We say the equation has two equal roots, $3$ and $3$.
- Factorisation can also work with surds. For example, $\sqrt2\,x^2 + 3x + \sqrt2 = 0$: here $ac = 2$, and $2 + 1 = 3$, so split $3x$ as $2x + x$. This gives $(x + \sqrt2)(\sqrt2\,x + 1) = 0$.

## 4. The quadratic formula

When factors are hard to find, use the formula. The roots of $ax^2 + bx + c = 0$ are
$$x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}$$
This works when $b^2 - 4ac \ge 0$.

**Steps**
1. Write the equation in standard form.
2. Read off $a$, $b$ and $c$, **with their signs**.
3. Find $D = b^2 - 4ac$ first.
4. If $D \ge 0$, put the values into the formula and simplify.

:::example{title="Using the formula"}
Solve $x^2 - 2x - 4 = 0$.

$a = 1$, $b = -2$, $c = -4$. So $D = (-2)^2 - 4(1)(-4) = 4 + 16 = 20$.

$x = \dfrac{2 \pm \sqrt{20}}{2} = \dfrac{2 \pm 2\sqrt5}{2} = 1 \pm \sqrt5$

The roots are $1 + \sqrt5$ and $1 - \sqrt5$.
:::

- The formula always works when $D \ge 0$. Factorisation is quicker when the roots are nice numbers.
- (Beyond the Class 10 book) If $a, b, c$ are integers and $D$ is a perfect square (0, 1, 4, 9, 16, …), the roots are rational, so factorisation will work.

## 5. Nature of roots: the discriminant

- $D = b^2 - 4ac$ is called the **discriminant**. It tells you the type of roots **without solving**.

| Value of $D$ | Nature of roots |
|---|---|
| $D > 0$ | Two distinct real roots |
| $D = 0$ | Two equal real roots |
| $D < 0$ | No real roots |

- When $D > 0$, the roots are $\dfrac{-b + \sqrt D}{2a}$ and $\dfrac{-b - \sqrt D}{2a}$.
- When $D = 0$, both roots are $-\dfrac{b}{2a}$.
- When $D < 0$, no real number has a negative square, so there is no real root.

:::example{title="Finding the nature"}
$3x^2 - 2x + 1 = 0$: $D = 4 - 12 = -8 < 0$. No real roots.

$x^2 - 6x + 9 = 0$: $D = 36 - 36 = 0$. Two equal roots, both $\dfrac{6}{2} = 3$.
:::

- **Finding an unknown $k$:** for "two equal roots", put $D = 0$. For "real roots", put $D \ge 0$. If $k$ is in the $x^2$ term, check that $a \ne 0$ for your answer.

## 6. Roots and coefficients (from Chapter 2)

- If $\alpha$ and $\beta$ are the roots (real roots, so $D \ge 0$), then $\alpha + \beta = -\dfrac{b}{a}$ and $\alpha\beta = \dfrac{c}{a}$.
- So an equation whose roots have sum $S$ and product $P$ is $x^2 - Sx + P = 0$.
- Use these to check your roots quickly. For $3x^2 - 5x - 2 = 0$: the sum $2 - \frac13 = \frac53 = -\frac{-5}{3}$. Correct.

## 7. Word problems

**Steps**
1. Choose the unknown and call it $x$. Write its unit.
2. Write the other quantities in terms of $x$.
3. Use the given fact to form the equation. Bring it to standard form.
4. Solve it.
5. **Check each root against the situation.** Reject roots that make no sense: negative lengths, speeds or ages, or fractions of people or objects.

Common set-ups:
- **Two consecutive integers:** $x$ and $x + 1$. Consecutive odd (or even) numbers: $x$ and $x + 2$.
- **Area of a rectangle:** length $\times$ breadth.
- **Right triangle:** Pythagoras theorem, $(\text{side})^2 + (\text{side})^2 = (\text{hypotenuse})^2$.
- **Speed and time:** time $= \dfrac{\text{distance}}{\text{speed}}$. "Takes 1 hour less" gives (old time) $-$ (new time) $= 1$.
- **Ages:** in $n$ years, each age increases by $n$; $n$ years ago, each age was $n$ less.
- **"Is it possible?":** form the equation and find $D$. If $D < 0$, it is not possible.

:::example{title="A garden"}
A rectangular garden is 3 m longer than it is wide. Its area is 108 m². Find its sides.

Width $= x$ m, length $= (x + 3)$ m. Then $x(x + 3) = 108$, so $x^2 + 3x - 108 = 0$.

$(x + 12)(x - 9) = 0$ gives $x = 9$ or $x = -12$. A width cannot be negative, so the width is 9 m and the length is 12 m.
:::
