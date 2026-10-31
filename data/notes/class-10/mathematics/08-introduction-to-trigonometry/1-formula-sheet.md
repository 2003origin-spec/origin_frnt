---
title: "Introduction to Trigonometry: Formula Sheet"
type: formula_sheet
chapter: c10.mathematics.introduction-to-trigonometry
order: 1
---

## Symbols used

As in NCERT: triangle ABC is **right-angled at B**, and A is an acute angle. For angle A:
- **opposite side** = BC (it faces angle A);
- **adjacent side** = AB (it is an arm of angle A);
- **hypotenuse** = AC (it faces the right angle).

All ratios in this chapter are for acute angles, plus 0° and 90°.

## The six ratios

:::formula{title="Sine"}
$$\sin A = \frac{\text{opposite}}{\text{hypotenuse}} = \frac{BC}{AC}$$
:::

:::formula{title="Cosine"}
$$\cos A = \frac{\text{adjacent}}{\text{hypotenuse}} = \frac{AB}{AC}$$
:::

:::formula{title="Tangent"}
$$\tan A = \frac{\text{opposite}}{\text{adjacent}} = \frac{BC}{AB}$$
:::

:::formula{title="Cosecant (reciprocal of sine)"}
$$\operatorname{cosec} A = \frac{1}{\sin A} = \frac{AC}{BC}$$
Not defined when $\sin A = 0$, that is at $A = 0^\circ$.
:::

:::formula{title="Secant (reciprocal of cosine)"}
$$\sec A = \frac{1}{\cos A} = \frac{AC}{AB}$$
Not defined when $\cos A = 0$, that is at $A = 90^\circ$.
:::

:::formula{title="Cotangent (reciprocal of tangent)"}
$$\cot A = \frac{1}{\tan A} = \frac{AB}{BC}$$
Not defined at $A = 0^\circ$.
:::

:::formula{title="tan and cot from sin and cos"}
$$\tan A = \frac{\sin A}{\cos A}$$
$$\cot A = \frac{\cos A}{\sin A}$$
tan needs $\cos A \ne 0$ ($A \ne 90^\circ$). cot needs $\sin A \ne 0$ ($A \ne 0^\circ$).
:::

## Values for specific angles (Table 8.1)

| $A$ | $\sin A$ | $\cos A$ | $\tan A$ |
|---|---|---|---|
| 0° | $0$ | $1$ | $0$ |
| 30° | $\frac12$ | $\frac{\sqrt3}{2}$ | $\frac{1}{\sqrt3}$ |
| 45° | $\frac{1}{\sqrt2}$ | $\frac{1}{\sqrt2}$ | $1$ |
| 60° | $\frac{\sqrt3}{2}$ | $\frac12$ | $\sqrt3$ |
| 90° | $1$ | $0$ | not defined |

| $A$ | $\operatorname{cosec} A$ | $\sec A$ | $\cot A$ |
|---|---|---|---|
| 0° | not defined | $1$ | not defined |
| 30° | $2$ | $\frac{2}{\sqrt3}$ | $\sqrt3$ |
| 45° | $\sqrt2$ | $\sqrt2$ | $1$ |
| 60° | $\frac{2}{\sqrt3}$ | $2$ | $\frac{1}{\sqrt3}$ |
| 90° | $1$ | not defined | $0$ |

## Identities

:::formula{title="Identity 1: sin and cos"}
$$\sin^2 A + \cos^2 A = 1$$
True for $0^\circ \le A \le 90^\circ$. NCERT calls this equation (2). It comes from $AB^2 + BC^2 = AC^2$ divided by $AC^2$.
:::

:::formula{title="Identity 2: sec and tan"}
$$1 + \tan^2 A = \sec^2 A$$
True for $0^\circ \le A < 90^\circ$ (tan and sec are not defined at 90°). Divide the Pythagoras relation by $AB^2$. NCERT calls this equation (3).
:::

:::formula{title="Identity 3: cosec and cot"}
$$1 + \cot^2 A = \operatorname{cosec}^2 A$$
True for $0^\circ < A \le 90^\circ$ (cot and cosec are not defined at 0°). Divide the Pythagoras relation by $BC^2$. NCERT calls this equation (4).
:::

## Limits on the values

:::formula{title="Bounds"}
$$0 \le \sin A \le 1$$
$$0 \le \cos A \le 1$$
$$\sec A \ge 1$$
$$\operatorname{cosec} A \ge 1$$
sin and cos: for $0^\circ \le A \le 90^\circ$. sec: for $0^\circ \le A < 90^\circ$. cosec: for $0^\circ < A \le 90^\circ$. $\tan A$ and $\cot A$ can be any value $\ge 0$, including values above 1.
:::
