; Волна: правило брандмауэра для сетевой синхронизации (TCP 51789).
; При per-user установке netsh может не сработать — в приложении есть
; кнопка «Открыть порт в брандмауэре» с UAC-элевацией как надёжный путь.

!macro customInstall
  nsExec::Exec `netsh advfirewall firewall add rule name="Volna Sync" dir=in action=allow protocol=TCP localport=51789`
!macroend

!macro customUnInstall
  nsExec::Exec `netsh advfirewall firewall delete rule name="Volna Sync"`
!macroend
