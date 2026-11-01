---
title: "Experimental Skills: Formula Sheet"
type: formula_sheet
chapter: c12.physics.experimental-skills
order: 1
---

No NCERT chapter — these notes follow the JEE Main and NEET experimental-skills lists. Both syllabi (2026, Unit 20) list the **same 18 experiments**; "E5" below means item 5 of that list. Methods follow the NCERT lab manuals.

## Reading instruments

:::formula{title="Vernier calipers: least count (E1)"}
$$\text{LC} = 1\,\text{MSD} - 1\,\text{VSD}$$
$$\text{LC} = \frac{\text{value of 1 MSD}}{N}$$
MSD = main scale division, VSD = vernier scale division. The second form holds when $N$ VSD $= (N - 1)$ MSD. Common case: 1 MSD = 1 mm, 10 VSD = 9 MSD, so LC = 0.1 mm = 0.01 cm.
:::

:::formula{title="Vernier reading"}
$$\text{Reading} = \text{MSR} + n \times \text{LC}$$
MSR = main scale mark just before the vernier zero, $n$ = the vernier mark that lines up with a main scale mark.
:::

:::formula{title="Screw gauge: pitch and least count (E2)"}
$$\text{Pitch} = \frac{\text{distance moved}}{\text{number of turns}}$$
$$\text{LC} = \frac{\text{pitch}}{N}$$
$N$ = divisions on the circular scale. Common case: pitch 1 mm (or 0.5 mm), $N$ = 100 (or 50), LC = 0.01 mm.
:::

:::formula{title="Screw gauge reading"}
$$\text{Reading} = \text{LSR} + n \times \text{LC}$$
LSR = linear (main) scale reading, $n$ = circular scale division on the reference line.
:::

:::formula{title="Zero error and correction"}
$$\text{True} = \text{Observed} - (\text{zero error})$$
Positive zero error (reads a little more than zero): $+\,n \times \text{LC}$. Negative zero error (reads a little less than zero): $-(N - n) \times \text{LC}$. Here $n$ is the division that lines up with the jaws (or faces) closed, and $N$ is the number of vernier (or circular) divisions. Subtract the zero error **with its sign**.
:::

:::formula{title="Travelling microscope (E15)"}
$$\text{LC} = \frac{\text{value of 1 MSD}}{N}$$
It has a vernier, so it is read like vernier calipers. Common case: 1 MSD = 0.5 mm, 50 VSD, LC = 0.01 mm.
:::

## Errors (from Units and Measurement)

:::formula{title="Error in a product or power"}
$$Z = \frac{A^p B^q}{C^r}$$
$$\begin{aligned} \frac{\Delta Z}{Z} &= p\frac{\Delta A}{A} + q\frac{\Delta B}{B} \\ &\quad + r\frac{\Delta C}{C} \end{aligned}$$
Relative errors always **add**, even for division. A quantity raised to a power counts that many times.
:::

:::formula{title="Time period from many oscillations"}
$$T = \frac{t}{n}$$
$$\frac{\Delta T}{T} = \frac{\Delta t}{t}$$
$t$ = time for $n$ oscillations. Timing more oscillations makes the relative error smaller.
:::

## Mechanics and heat

:::formula{title="Simple pendulum (E3)"}
$$T = 2\pi\sqrt{\frac{L}{g}}$$
$L$ = effective length = string length + radius of bob. Holds for small amplitude. A graph of $L$ against $T^2$ is a straight line of slope $g/4\pi^2$.
:::

:::formula{title="Energy and amplitude (E3)"}
$$E = \tfrac12 m\omega^2 A^2$$
$$E \propto A^2$$
So a graph of $A^2$ against time shows how the energy is lost.
:::

:::formula{title="Principle of moments (E4)"}
$$m\,d_1 = M\,d_2$$
Metre scale balanced on a knife edge at its centre of gravity. $m$ = unknown mass at distance $d_1$ from the knife edge, $M$ = known mass at $d_2$ on the other side.
:::

:::formula{title="Young's modulus (E5)"}
$$Y = \frac{MgL}{\pi r^2\,l}$$
$M$ = load (kg), $L$ = original length of the wire, $r$ = radius of the wire, $l$ = extension. SI unit: N/m² (Pa). Holds within the elastic limit. From the graph of extension $l$ against load $M$ (in kg), slope $= l/M$ and $Y = \dfrac{gL}{\pi r^2 \times \text{slope}}$.
:::

:::formula{title="Surface tension by capillary rise (E6)"}
$$S = \frac{r h \rho g}{2\cos\theta}$$
$r$ = radius of the capillary bore, $h$ = rise, $\rho$ = density of water, $\theta$ = contact angle. For water in clean glass $\theta \approx 0$, so $S = \tfrac12 r h\rho g$. Unit: N/m.
:::

:::formula{title="Viscosity by terminal velocity (E7)"}
$$v_t = \frac{2r^2(\rho - \sigma)g}{9\eta}$$
$$\eta = \frac{2r^2(\rho - \sigma)g}{9v_t}$$
$r$ = radius of the ball, $\rho$ = density of the ball, $\sigma$ = density of the liquid. Unit of $\eta$: Pa s. Holds for a small ball moving slowly in a wide vessel.
:::

:::formula{title="Speed of sound: resonance tube (E8)"}
$$l_1 + e = \frac{\lambda}{4}$$
$$l_2 + e = \frac{3\lambda}{4}$$
$$v = 2\nu(l_2 - l_1)$$
$$e = \frac{l_2 - 3l_1}{2}$$
$l_1, l_2$ = first and second resonance lengths, $e$ = end correction (about $0.3\,d$, $d$ = inner diameter), $\nu$ = frequency of the fork. Closed pipe (water closes the lower end).
:::

:::formula{title="Method of mixtures (E9)"}
$$m_1 s_1 (T_1 - T) = (m_2 s_w + m_c s_c)(T - T_2)$$
Heat lost by the hot body = heat gained by the water and the calorimeter. $T_1$ = hot body, $T_2$ = water at start, $T$ = final (mixture). Assumes no heat lost to the surroundings. For a liquid, put the liquid in place of the water and use a solid of known $s_1$.
:::

## Electricity

:::formula{title="Metre bridge (E10)"}
$$\frac{X}{R} = \frac{l}{100 - l}$$
$X$ = unknown in the left gap, $R$ = resistance box in the right gap, $l$ = balance length in cm from the left end.
:::

:::formula{title="Resistivity (E10)"}
$$\rho = \frac{X\,\pi r^2}{L}$$
$$\rho = \frac{\pi D^2 X}{4L}$$
$L$ = length of the wire, $r$ = radius, $D$ = diameter. Unit: Ω m.
:::

:::formula{title="Ohm's law (E11)"}
$$V = IR$$
Slope of the $V$–$I$ graph ($V$ on the $y$-axis) $= R$. If $I$ is on the $y$-axis, slope $= 1/R$. Holds at constant temperature.
:::

:::formula{title="Galvanometer: half deflection (E12)"}
$$G = \frac{RS}{R - S}$$
$$k = \frac{E}{(R + G)\,\theta}$$
$R$ = series resistance (deflection $\theta$), $S$ = shunt that halves it to $\theta/2$, $E$ = emf of the cell (internal resistance neglected), $k$ = figure of merit in A per division. If $R \gg S$, $G \approx S$.
:::

## Optics

:::formula{title="Mirror and lens (E13)"}
Mirror:
$$\frac{1}{v} + \frac{1}{u} = \frac{1}{f}$$
Lens:
$$\frac{1}{v} - \frac{1}{u} = \frac{1}{f}$$
NCERT Cartesian signs: distances measured from the pole or optical centre, against the incoming light negative. Convex mirror (with a lens): $f = R/2$.
:::

:::formula{title="Prism (E14)"}
$$i + e = A + \delta$$
$$n = \frac{\sin\frac{A + \delta_m}{2}}{\sin\frac{A}{2}}$$
At minimum deviation $\delta_m$: $i = e$ and $r_1 = r_2 = A/2$.
:::

:::formula{title="Glass slab with travelling microscope (E15)"}
$$n = \frac{\text{real depth}}{\text{apparent depth}}$$
$$n = \frac{R_3 - R_1}{R_3 - R_2}$$
$R_1$ = mark without slab, $R_2$ = mark seen through the slab, $R_3$ = top surface of the slab (microscope moves up, so $R_1 < R_2 < R_3$).
:::

## Semiconductors

:::formula{title="Diode resistance (E16, E17)"}
$$r_d = \frac{\Delta V}{\Delta I}$$
Dynamic resistance from the slope of the $I$–$V$ curve at a point. Static resistance is $V/I$ at that point.
:::
