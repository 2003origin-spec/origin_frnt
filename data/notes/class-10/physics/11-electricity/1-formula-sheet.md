---
title: "Electricity (Class 10): Formula Sheet"
type: formula_sheet
chapter: c10.physics.electricity
order: 1
---

## Current and potential difference

:::formula{title="Electric current"}
$$I = \frac{Q}{t}$$
$I$ = current (ampere, A), $Q$ = charge that flows through a cross-section (coulomb, C), $t$ = time (s).
$1$ A $= 1$ C/s. $1$ mA $= 10^{-3}$ A, $1\ \mu$A $= 10^{-6}$ A.
:::

:::formula{title="Number of electrons"}
$$n = \frac{Q}{e}$$
$e = 1.6 \times 10^{-19}$ C (charge of one electron, size only). So 1 C is the charge of nearly $6 \times 10^{18}$ electrons.
:::

:::formula{title="Potential difference"}
$$V = \frac{W}{Q}$$
$V$ = potential difference (volt, V), $W$ = work done to move the charge (J). $1$ V $= 1$ J/C.
So the work done is $W = VQ$.
:::

## Ohm's law and resistance

:::formula{title="Ohm's law"}
$$V = IR$$
$$I = \frac{V}{R}$$
$R$ = resistance (ohm, $\Omega$). $1\ \Omega = 1$ V/A.
Holds for a metallic wire **only if its temperature stays the same**.
:::

:::formula{title="Resistance of a wire"}
$$R = \rho\,\frac{l}{A}$$
$l$ = length (m), $A$ = area of cross-section (m²), $\rho$ = resistivity ($\Omega$ m).
For a round wire of diameter $d$ (radius $r$):
$$A = \pi r^2 = \frac{\pi d^2}{4}$$
For a uniform wire. $\rho$ depends only on the material and its temperature, not on the shape.
:::

## Resistors in series and parallel

:::formula{title="Series"}
$$R_s = R_1 + R_2 + R_3$$
Same current $I$ through each resistor. The voltages add:
$$V = V_1 + V_2 + V_3$$
$R_s$ is **more** than the largest single resistance. $n$ equal resistors $R$ in series give $nR$.
:::

:::formula{title="Parallel"}
$$\frac{1}{R_p} = \frac{1}{R_1} + \frac{1}{R_2} + \frac{1}{R_3}$$
Same potential difference $V$ across each resistor. The currents add:
$$I = I_1 + I_2 + I_3$$
$R_p$ is **less** than the smallest single resistance.
:::

:::formula{title="Parallel shortcuts"}
Two resistors (product over sum):
$$R_p = \frac{R_1 R_2}{R_1 + R_2}$$
$n$ equal resistors $R$ in parallel:
$$R_p = \frac{R}{n}$$
Both come straight from the parallel formula above.
:::

## Heating effect

:::formula{title="Joule's law of heating"}
$$H = I^2 R t$$
$H$ = heat produced (J), $t$ = time (s).
Other forms for a resistor (use $V = IR$):
$$H = VIt$$
$$H = \frac{V^2 t}{R}$$
For a steady current through a resistor. In a purely resistive circuit (only resistors), all the energy from the source becomes heat. In a fan, only part of $VIt$ becomes heat.
:::

## Power and energy

:::formula{title="Electric power"}
$$P = VI$$
$$P = I^2 R$$
$$P = \frac{V^2}{R}$$
$P = VI$ works for any device. $P = I^2R$ and $P = V^2/R$ need $V = IR$, so use them for a resistor (heater, bulb filament), not for a motor.
$P$ = power (watt, W). $1$ W $= 1$ V $\times$ 1 A $= 1$ J/s. $1$ kW $= 1000$ W.
:::

:::formula{title="Electrical energy"}
$$E = Pt$$
$$E = VIt$$
In J when $P$ is in W and $t$ in s. In kW h when $P$ is in kW and $t$ in hours.
:::

:::formula{title="Commercial unit (1 unit)"}
$$1\ \text{kW h} = 3.6 \times 10^6\ \text{J}$$
$1$ kW h $= 1000$ W $\times$ 3600 s. Bill $=$ (units used) $\times$ (rate per unit).
:::

:::formula{title="Rated appliances"}
A label "$P$ watt, $V$ volt" gives the resistance:
$$R = \frac{V^2}{P}$$
On a different voltage $V'$, if $R$ does not change:
$$P' = P\left(\frac{V'}{V}\right)^2$$
Half the voltage gives **one-fourth** the power. (A real bulb filament's resistance changes with temperature, so this is an estimate.)
:::
