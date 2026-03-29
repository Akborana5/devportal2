FROM ubuntu:22.04

USER root
RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    curl \
    git \
    sudo \
    wget \
    nano \
    htop \
    build-essential \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

RUN adduser --disabled-password --gecos '' user \
    && echo "user ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers

RUN mkdir -p /home/user/app && chown -R user:user /home/user/app

ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH \
    PYTHONUNBUFFERED=1

WORKDIR $HOME/app

USER user
RUN python3 -m pip install --upgrade pip

COPY --chown=user:user requirements.txt .
RUN pip3 install --no-cache-dir -r requirements.txt

COPY --chown=user:user . .

RUN mkdir -p user_spaces && chmod -R 777 user_spaces
RUN chmod +x start.sh

EXPOSE 7860

ENTRYPOINT ["./start.sh"]
