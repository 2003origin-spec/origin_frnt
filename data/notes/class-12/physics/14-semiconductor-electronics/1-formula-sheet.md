---
title: "Semiconductor Electronics: Formula Sheet"
type: formula_sheet
chapter: c12.physics.semiconductor-electronics
order: 1
---

## Charge carriers

:::formula{title="Intrinsic (pure) semiconductor"}
$$n_e = n_h = n_i$$
$n_e$ = free electrons per m³, $n_h$ = holes per m³, $n_i$ = intrinsic carrier concentration (m⁻³). Holds only for a **pure** semiconductor.
:::

:::formula{title="Total current"}
$$I = I_e + I_h$$
$I_e$ = electron current, $I_h$ = hole current. Electrons drift towards the positive side, holes towards the negative side, but both currents point the **same way**, so they add.
:::

:::formula{title="Mass-action law"}
$$n_e\,n_h = n_i^2$$
Holds in **thermal equilibrium**, for pure and doped semiconductors alike. $n_i$ depends on the material and the temperature, so use the $n_i$ for the same temperature.
:::

:::formula{title="n-type: donor density N_D"}
$$n_e \approx N_D$$
$$n_h = \frac{n_i^2}{N_D}$$
Needs $N_D \gg n_i$ and all donors ionised (true at room temperature). $N_D$ = donor atoms per m³.
:::

:::formula{title="p-type: acceptor density N_A"}
$$n_h \approx N_A$$
$$n_e = \frac{n_i^2}{N_A}$$
Same conditions: $N_A \gg n_i$, all acceptors ionised.
:::

:::formula{title="Doping level"}
$$N_D = (\text{fraction doped}) \times N_{Si}$$
1 ppm means 1 dopant atom per $10^6$ host atoms. $N_{Si}$ = host atoms per m³ (about $5\times10^{28}$ m⁻³ for Si, as in NCERT Example 14.2).
:::

:::formula{title="Conductivity with two carriers (exam extra)"}
$$\sigma = e\,(n_e\mu_e + n_h\mu_h)$$
$$\rho = \frac{1}{\sigma}$$
Not in NCERT. It extends the mobility and conductivity of Current Electricity (in both syllabi) to electrons plus holes. $e = 1.6\times10^{-19}$ C, $\mu$ = mobility (m² V⁻¹ s⁻¹), $\sigma$ in S m⁻¹, $\rho$ in Ω m. In a doped sample, keep only the majority-carrier term if the other is tiny.
:::

## Energy bands

:::formula{title="Energy band gap"}
$$E_g = E_C - E_V$$
$E_C$ = bottom of the conduction band, $E_V$ = top of the valence band (in eV).

| Material | $E_g$ (eV) |
| --- | --- |
| C (diamond) | 5.4 |
| Si | 1.1 |
| Ge | 0.7 |
| Sn | 0 (a metal) |

Insulator: $E_g > 3$ eV. Semiconductor: about 0.2 to 3 eV. Metal: $E_g \approx 0$ (bands overlap, or a band is partly filled).
:::

:::formula{title="Photon energy and band gap (used for LEDs and photodiodes)"}
$$E = h\nu = \frac{hc}{\lambda}$$
$$\lambda\,(\text{nm}) \approx \frac{1240}{E\,(\text{eV})}$$
A photon can make an electron-hole pair only if $h\nu \ge E_g$, i.e. $\lambda \le hc/E_g$. An LED gives photons of energy about $E_g$. ($hc \approx 1240$ eV nm.)
:::

## p-n junction diode

:::formula{title="Barrier height under bias"}
$$\text{Forward: } V_0 - V$$
$$\text{Reverse: } V_0 + V$$
$V_0$ = barrier (built-in) potential, $V$ = applied voltage. Forward: p-side to $+$. Reverse: n-side to $+$.
:::

:::formula{title="Dynamic resistance"}
$$r_d = \frac{\Delta V}{\Delta I}$$
Small change in voltage ÷ small change in current, read off the $V$–$I$ curve **near the working point**. It is not constant: it is small in forward bias and very large in reverse bias. NCERT Example 14.4 also uses $V/I$ (10 V ÷ 1 µA $= 10^7$ Ω) for the reverse resistance.
:::

:::formula{title="Typical diode numbers"}
Cut-in (threshold) voltage: about **0.7 V** for Si, about **0.2 V** for Ge.

Forward current: mA. Reverse saturation current: µA.

Depletion layer: about $0.1$ µm thick.
:::

:::formula{title="Diode in a circuit (exam extra: problem method)"}
$$I = \frac{E - V_\gamma}{R}$$
For a forward-biased diode in series with a resistor $R$ and a battery $E$. $V_\gamma$ = drop across a conducting diode (0.7 V for Si if the question says so; 0 for an **ideal** diode). A reverse-biased diode is treated as an open switch ($I \approx 0$).
:::

## Rectifiers

:::formula{title="Output frequency"}
$$\text{Half-wave: } f_{out} = f$$
$$\text{Full-wave: } f_{out} = 2f$$
$f$ = frequency of the ac input. For 50 Hz mains: 50 Hz and 100 Hz (NCERT Exercise 14.6).
:::

:::formula{title="Capacitor filter"}
$$\tau = C R_L$$
The capacitor is joined **across** (in parallel with) the load $R_L$. The bigger the time constant, the slower it discharges and the smoother the dc. The output is then close to the **peak** of the rectified voltage.
:::

:::formula{title="Average output and PIV (exam extra)"}
Not in NCERT; asked under "diode as a rectifier" in both syllabi. $V_m$ = peak voltage, ideal diodes, resistive load, no filter.

**Half-wave:** $V_{dc} = \dfrac{V_m}{\pi}$, PIV $= V_m$.

**Full-wave, centre-tap:** $V_{dc} = \dfrac{2V_m}{\pi}$, PIV $= 2V_m$, where $V_m$ = peak of **each half** of the secondary.

**Full-wave, bridge:** $V_{dc} = \dfrac{2V_m}{\pi}$, PIV $= V_m$.

PIV (peak inverse voltage) = the largest reverse voltage a diode must stand. The diode's breakdown voltage must be more than this.
:::

## Zener regulator (exam extra: in both syllabi, not in NCERT)

:::formula{title="Currents in a Zener regulator"}
$$I_L = \frac{V_Z}{R_L}$$
$$I_s = \frac{V_{in} - V_Z}{R_s}$$
$$I_Z = I_s - I_L$$
Zener reverse-biased and in **parallel** with the load $R_L$; $R_s$ = series resistor. Valid only while the Zener is in breakdown. Check first: without the Zener, the load voltage $\dfrac{V_{in}R_L}{R_s + R_L}$ must be at least $V_Z$. If not, the Zener carries no current.
:::

## Logic gates (exam extra: in both syllabi, not in NCERT)

:::formula{title="Boolean expressions"}
$$\text{NOT: } Y = \overline{A}$$
$$\text{OR: } Y = A + B$$
$$\text{AND: } Y = A\cdot B$$
$$\text{NAND: } Y = \overline{A\cdot B}$$
$$\text{NOR: } Y = \overline{A + B}$$
Here $+$ means OR and $\cdot$ means AND, not ordinary sums and products: $1 + 1 = 1$.
:::

:::formula{title="De Morgan's theorems (exam extra)"}
$$\overline{A\cdot B} = \overline{A} + \overline{B}$$
$$\overline{A + B} = \overline{A}\cdot\overline{B}$$
Use them to simplify circuits built from several gates.
:::
