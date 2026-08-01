from PIL import Image

def remove_white_bg(input_path, output_path):
    img = Image.open(input_path)
    img = img.convert("RGBA")
    
    datas = img.getdata()
    newData = []
    for item in datas:
        # Check if the pixel is white (or very close to white)
        if item[0] > 240 and item[1] > 240 and item[2] > 240:
            # Change all white (also shades of whites)
            # pixels to transparent
            newData.append((255, 255, 255, 0))
        else:
            newData.append(item)
            
    img.putdata(newData)
    img.save(output_path, "PNG")

remove_white_bg("c:\\Users\\tmaut\\Downloads\\THE PHOENIX\\NewKet\\frontend\\public\\LogoOfficiel_PWA_Icone.png", "c:\\Users\\tmaut\\Downloads\\THE PHOENIX\\NewKet\\frontend\\public\\LogoOfficiel_PWA_Icone_transparent.png")
print("Done!")
