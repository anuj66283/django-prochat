from django import forms

class ProchatWidget(forms.Textarea):
    template_name = "django_prochat/widget.html"

    class Media:
        js = ("django_prochat/js/prochat.js",)
        css = {
            "all": ("django_prochat/css/prochat.css",)
        }
