---
title: "Differential Equations: Short Notes"
type: short_notes
chapter: c12.mathematics.differential-equations
order: 2
---

## 1. What a differential equation is

- A **differential equation** is an equation with a derivative (or derivatives) of the dependent variable with respect to the independent variable. Example: $x\dfrac{dy}{dx} + y = 0$.
- **Ordinary** differential equation: derivatives with respect to **one** independent variable only. (With two or more, it is a partial differential equation, which is not in this chapter.) "Differential equation" here always means an ordinary one.
- Notation: $y' = \dfrac{dy}{dx}$, $y'' = \dfrac{d^2y}{dx^2}$, $y''' = \dfrac{d^3y}{dx^3}$, and $y_n = \dfrac{d^ny}{dx^n}$ for higher orders.

## 2. Order

- The **order** is the order of the highest derivative that appears.
- $\dfrac{dy}{dx} = e^x$ has order 1. $\dfrac{d^2y}{dx^2} + y = 0$ has order 2. $y''' + x^2 (y'')^3 = 0$ has order 3.

## 3. Degree

- The degree is defined **only when the equation is a polynomial in the derivatives** $y', y'', y''', \dots$ The function $y$ itself may appear in any form (such as $\sin y$).
- Then the **degree** is the highest power (a positive whole number) of the **highest-order** derivative.
- Order and degree (when defined) are always **positive integers**.
- If a derivative sits under a root or a fractional power, NCERT does not say what to do. The usual exam convention: clear the root first, then read the degree (see Traps).

| Equation | Order | Degree |
|---|---|---|
| $y'' + 2y' + \sin y = 0$ | 2 | 1 |
| $(y')^2 + y' - \sin^2 y = 0$ | 1 | 2 |
| $y' + \sin(y') = 0$ | 1 | not defined |
| $y''' + y^2 + e^{y'} = 0$ | 3 | not defined |

:::example{title="Order and degree"}
$\left(y'''\right)^2 + (y'')^3 + (y')^4 + y^5 = 0$. The highest derivative is $y'''$, so the order is 3. It appears squared, so the degree is 2 (the cube on $y''$ does not matter).
:::

## 4. General and particular solutions

- A **solution** is a function $y = \varphi(x)$ that makes LHS = RHS when it and its derivatives are put into the equation. Its graph is a **solution curve** (integral curve).
- The **general solution** (primitive) contains arbitrary constants: as many as the order of the equation.
- A **particular solution** has no arbitrary constants. It comes from the general solution by giving the constants fixed values, usually from a given condition such as "$y = 1$ when $x = 0$".
- Example: $y = a\sin(x + b)$ is the general solution of $y'' + y = 0$ (two constants, order 2). $y = 2\sin\left(x + \frac{\pi}{4}\right)$ is a particular solution.

:::example{title="Checking a solution"}
Is $y = e^{-3x}$ a solution of $y'' + y' - 6y = 0$?

$y' = -3e^{-3x}$ and $y'' = 9e^{-3x}$. LHS $= 9e^{-3x} - 3e^{-3x} - 6e^{-3x} = 0$ = RHS. **Yes.**
:::

## 5. Variables separable

- NCERT solves only **first order, first degree** equations, $\dfrac{dy}{dx} = F(x, y)$, by three methods: separable, homogeneous and linear.
- **Separable:** $F(x, y) = g(x)\,h(y)$. Bring all the $y$ terms to the side with $dy$ and all the $x$ terms to the side with $dx$, then integrate both sides. Add **one** constant.
- Applications in NCERT: a curve through a point with a given slope, continuous compound interest, bacteria growth, a balloon whose volume changes at a constant rate.

:::example{title="Separable, with a condition"}
$\dfrac{dy}{dx} = -4xy^2$, $y = 1$ when $x = 0$.

For $y \ne 0$: $\dfrac{dy}{y^2} = -4x\,dx$, so $-\dfrac1y = -2x^2 + C$, and $y = \dfrac{1}{2x^2 - C}$.

$x = 0$, $y = 1$ gives $C = -1$. So $y = \dfrac{1}{2x^2 + 1}$.
:::

## 6. Homogeneous equations

- $F(x, y)$ is **homogeneous of degree $n$** if $F(\lambda x, \lambda y) = \lambda^n F(x, y)$ for every non-zero $\lambda$. Examples: $y^2 + 2xy$ (degree 2), $2x - 3y$ (degree 1), $\cos\frac{y}{x}$ (degree 0). $\sin x + \cos y$ is not homogeneous.
- $\dfrac{dy}{dx} = F(x, y)$ is a **homogeneous differential equation** when $F$ is homogeneous of **degree zero**, that is, $F$ depends only on $\dfrac{y}{x}$.
- A quick test: if $F$ is a fraction whose top and bottom are homogeneous **of the same degree**, the equation is homogeneous.

**Method ($y = vx$):**
1. Write the equation as $\dfrac{dy}{dx} = g\!\left(\dfrac{y}{x}\right)$.
2. Put $y = vx$ and $\dfrac{dy}{dx} = v + x\dfrac{dv}{dx}$.
3. This gives $x\dfrac{dv}{dx} = g(v) - v$, which is separable. Integrate.
4. Replace $v$ by $\dfrac{y}{x}$.

- If it is easier to write $\dfrac{dx}{dy} = h\!\left(\dfrac{x}{y}\right)$, put $x = vy$ instead (NCERT Example 12).

:::example{title="Homogeneous"}
$\dfrac{dy}{dx} = \dfrac{x^2 + y^2}{2xy}$. Put $y = vx$: $v + x\dfrac{dv}{dx} = \dfrac{1 + v^2}{2v}$, so $x\dfrac{dv}{dx} = \dfrac{1 - v^2}{2v}$.

Separate: $\dfrac{2v\,dv}{v^2 - 1} = -\dfrac{dx}{x}$, so $\log|v^2 - 1| = -\log|x| + \log|C_1|$.

Put back $v = \frac{y}{x}$: the family is $x^2 - y^2 = Cx$.
:::

## 7. Linear equations

- **First order linear:** $\dfrac{dy}{dx} + Py = Q$, where $P$ and $Q$ are constants or functions of $x$ only. $y$ and $\dfrac{dy}{dx}$ appear only to the first power and are never multiplied together.
- **Why the I.F. works:** multiplying by $g(x) = e^{\int P\,dx}$ turns the left side into $\dfrac{d}{dx}\left[y\,g(x)\right]$. This $g(x)$ is the **integrating factor**.

**Steps:**
1. Write the equation as $\dfrac{dy}{dx} + Py = Q$ (divide so that $\dfrac{dy}{dx}$ has coefficient 1).
2. Find $\text{I.F.} = e^{\int P\,dx}$. No constant is needed here.
3. Write $y \cdot \text{I.F.} = \displaystyle\int Q \cdot \text{I.F.}\,dx + C$ and integrate.

- **Linear in $x$:** if the equation is linear in $x$ but not in $y$ (for example, $y^2$ or $\tan^{-1}y$ appears), write it as $\dfrac{dx}{dy} + P_1 x = Q_1$. Then $\text{I.F.} = e^{\int P_1\,dy}$ and $x \cdot \text{I.F.} = \displaystyle\int Q_1 \cdot \text{I.F.}\,dy + C$.

:::example{title="Linear in y"}
$x\dfrac{dy}{dx} + 2y = x^2$ ($x \ne 0$). Divide by $x$: $\dfrac{dy}{dx} + \dfrac{2}{x}y = x$.

$\text{I.F.} = e^{2\log x} = x^2$. So $yx^2 = \displaystyle\int x^3\,dx = \frac{x^4}{4} + C$, and $y = \dfrac{x^2}{4} + Cx^{-2}$.
:::

:::example{title="Linear in x"}
$y\,dx - (x + 2y^2)\,dy = 0$. Write $\dfrac{dx}{dy} - \dfrac{x}{y} = 2y$.

$\text{I.F.} = e^{-\log y} = \dfrac1y$. So $\dfrac{x}{y} = \displaystyle\int 2\,dy = 2y + C$, and $x = 2y^2 + Cy$.
:::

## 8. Which method?

| The equation | Method |
|---|---|
| $y'$ = (function of $x$) × (function of $y$) | Separate |
| $y'$ = a function of $y/x$ only | $y = vx$ |
| $y' + Py = Q$, $P, Q$ in $x$ | I.F. $e^{\int P\,dx}$ |
| $x' + P_1x = Q_1$, $P_1, Q_1$ in $y$ | I.F. $e^{\int P_1\,dy}$ |

Here $x'$ means $\dfrac{dx}{dy}$. Try them in this order. An equation can fit more than one type: $\dfrac{dy}{dx} = \dfrac{y}{x}$ is separable, homogeneous **and** linear.
