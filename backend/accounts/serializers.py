from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework.validators import UniqueValidator
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

User = get_user_model()

# Deliberately vague — used for both "wrong password" and "no such user" so
# this endpoint can't be used to enumerate which emails have an account.
INVALID_CREDENTIALS_MESSAGE = "Invalid email or password."

# Also deliberately vague on registration: DRF's default UniqueValidator
# message ("user with this email already exists") confirms an email is
# registered, which is its own account-enumeration vector.
EMAIL_UNAVAILABLE_MESSAGE = (
    "That email couldn't be used. Try a different one, or log in if you already have an account."
)


class RegisterSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(
        validators=[UniqueValidator(queryset=User.objects.all(), message=EMAIL_UNAVAILABLE_MESSAGE)]
    )
    password = serializers.CharField(write_only=True, validators=[validate_password])

    class Meta:
        model = User
        fields = ("id", "email", "password")

    def create(self, validated_data):
        return User.objects.create_user(
            email=validated_data["email"],
            password=validated_data["password"],
        )


class EmailTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Same as simplejwt's default, but with our own wording for a failed
    login instead of "No active account found with the given credentials"."""

    default_error_messages = {"no_active_account": INVALID_CREDENTIALS_MESSAGE}
