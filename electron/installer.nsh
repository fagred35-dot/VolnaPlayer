; Волна: синхронизация выключена по умолчанию (opt-in в приложении),
; поэтому входящее правило брандмауэра при установке БОЛЬШЕ не добавляется —
; пользователь открывает порт кнопкой «Открыть порт в брандмауэре» в секции
; «Синхронизация» (с UAC-элевацией), когда реально ей пользуется.
; При удалении чистим правило, оставшееся от старых версий установщика.

!macro customUnInstall
  nsExec::Exec `netsh advfirewall firewall delete rule name="Volna Sync"`
  nsExec::Exec `netsh advfirewall firewall delete rule name="Volna Sync UDP"`
!macroend
